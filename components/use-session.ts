"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { SessionEvent } from "@/lib/session";
import { payloadSchema, viewSchema } from "@/lib/view";
import type { SessionView } from "@/lib/view";

/** Connection state of the session page. */
export type Status = "loading" | "ready" | "missing" | "taken" | "offline";

/** A short message shown to the player, e.g. about a penalty. */
export interface Notice {
  id: number;
  text: string;
}

/** An event as sent by the page; the hook adds the client id. */
export type Outgoing = SessionEvent extends infer E
  ? E extends SessionEvent
    ? Omit<E, "clientId">
    : never
  : never;

const NOTICE_MS = 4500;

// Identifies this page load, so only the most recently opened tab can play.
const TAB_ID = crypto.randomUUID();

const cacheKey = (id: string): string => `mimi:view:${id}`;

const readCachedRaw = (id: string): string | null => {
  try {
    return localStorage.getItem(cacheKey(id));
  } catch {
    return null;
  }
};

const parseCached = (raw: string | null): SessionView | null => {
  if (raw === null) {
    return null;
  }

  try {
    const result = viewSchema.safeParse(JSON.parse(raw));

    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

// The cache is only read once on load, so there is nothing to subscribe to.
const subscribeNever = () => () => {
  // Nothing to clean up.
};

const writeCache = (id: string, view: SessionView): void => {
  try {
    localStorage.setItem(cacheKey(id), JSON.stringify(view));
  } catch {
    // The cache is a convenience only; the server holds the real state.
  }
};

const statusFor = (code: number): Status | null => {
  if (code === 404) {
    return "missing";
  }

  if (code === 409) {
    return "taken";
  }

  return null;
};

/**
 * Talks to the server, which owns all state. Events are sent one at a time,
 * in order, so the server never sees them out of sequence. Local storage is
 * only a cache for a faster first paint.
 * @param id - Session id from the URL.
 * @returns Current view, status, notices and a way to send events.
 */
export const useSession = (id: string) => {
  const [view, setView] = useState<SessionView | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [skew, setSkew] = useState(0);
  const queue = useRef<Promise<void> | null>(null);
  const noticeId = useRef(0);

  const dropNotices = useCallback((ids: number[]) => {
    const gone = new Set(ids);

    setNotices((current) => current.filter((n) => !gone.has(n.id)));
  }, []);

  const pushNotices = useCallback(
    (texts: string[]) => {
      if (texts.length === 0) {
        return;
      }

      const added = texts.map((text) => {
        noticeId.current += 1;

        return { id: noticeId.current, text };
      });

      setNotices((current) => [...current, ...added].slice(-3));
      setTimeout(
        dropNotices,
        NOTICE_MS,
        added.map((n) => n.id)
      );
    },
    [dropNotices]
  );

  const post = useCallback(
    async (event: Outgoing): Promise<void> => {
      try {
        const response = await fetch(`/api/sessions/${id}`, {
          body: JSON.stringify({ ...event, clientId: TAB_ID }),
          headers: { "Content-Type": "application/json" },
          keepalive: event.type === "blur",
          method: "POST",
        });

        const failed = statusFor(response.status);

        if (failed !== null) {
          setStatus(failed);

          return;
        }

        const payload = payloadSchema.parse(await response.json());

        setView(payload.view);
        setSkew(payload.view.now - Date.now());
        setStatus("ready");
        writeCache(id, payload.view);
        pushNotices(payload.notices);
      } catch {
        setStatus("offline");
      }
    },
    [id, pushNotices]
  );

  const send = useCallback(
    async (event: Outgoing): Promise<void> => {
      const previous = queue.current;

      const next = (async () => {
        await previous;
        await post(event);
      })();

      queue.current = next;
      await next;
    },
    [post]
  );

  /** Claims the session for this tab; any other open tab gets locked out. */
  const claim = useCallback(async () => {
    await send({ type: "hello" });
  }, [send]);

  useEffect(() => {
    void claim();
  }, [claim]);

  // Until the server answers, show the cached counters.
  const cachedRaw = useSyncExternalStore(
    subscribeNever,
    () => readCachedRaw(id),
    () => null
  );

  const cached = useMemo(() => parseCached(cachedRaw), [cachedRaw]);

  return { claim, notices, send, skew, status, view: view ?? cached };
};
