"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatDuration } from "@/lib/format";
import {
  ERRORS_PER_PENALTY_LINE,
  FOCUS_PENALTY_LINES,
  HEARTBEAT_MS,
  IDLE_MS,
  IDLE_PENALTY_LINES,
  PEEK_PENALTY_LINES,
  PROMPT_VISIBLE_MS,
} from "@/lib/rules";
import { cn } from "@/lib/utils";
import type { SessionView } from "@/lib/view";

import { TypingField } from "./typing-field";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import { Stat, StatGrid } from "./ui/stat";
import { useSession } from "./use-session";
import type { Notice, Outgoing } from "./use-session";

type Send = (event: Outgoing) => Promise<void>;

const useClock = (active: boolean, skew: number): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      if (active) {
        setNow(Date.now());
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [active]);

  return now + skew;
};

/**
 * Sends an idle event after 15 seconds without a keystroke, plus pings.
 * @param running - Whether the player is currently in a line.
 * @param send - Sends an event to the server.
 * @param lastKeyAt - Time of the last keystroke.
 * @param away - Whether the page is currently left.
 */
const useIdleAndHeartbeat = (
  running: boolean,
  send: Send,
  lastKeyAt: { current: number },
  away: { current: boolean }
) => {
  useEffect(() => {
    const idle = setInterval(() => {
      if (
        !running ||
        away.current ||
        Date.now() - lastKeyAt.current < IDLE_MS
      ) {
        return;
      }

      lastKeyAt.current = Date.now();
      void send({ type: "idle" });
    }, 1000);

    const beat = setInterval(() => {
      if (running && document.visibilityState === "visible") {
        void send({ type: "beat" });
      }
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(idle);
      clearInterval(beat);
    };
  }, [running, send, lastKeyAt, away]);
};

/**
 * Leaving the window or switching tabs is punished like idling.
 * @param running - Whether the player is currently in a line.
 * @param send - Sends an event to the server.
 * @param lastKeyAt - Time of the last keystroke.
 * @param away - Whether the page is currently left.
 */
const useFocusPenalty = (
  running: boolean,
  send: Send,
  lastKeyAt: { current: number },
  away: { current: boolean }
) => {
  useEffect(() => {
    const leave = () => {
      if (!running || away.current) {
        return;
      }

      away.current = true;
      void send({ type: "blur" });
    };

    const back = () => {
      if (!away.current || document.visibilityState !== "visible") {
        return;
      }

      away.current = false;
      lastKeyAt.current = Date.now();
      void send({ type: "beat" });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leave();
      } else {
        back();
      }
    };

    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running, send, lastKeyAt, away]);
};

/** No copying, cutting, dragging or context menu anywhere on the page. */
const useNoClipboard = () => {
  useEffect(() => {
    const block = (event: Event) => {
      event.preventDefault();
    };

    const types = ["copy", "cut", "paste", "dragstart", "drop", "contextmenu"];

    for (const type of types) {
      document.addEventListener(type, block);
    }

    return () => {
      for (const type of types) {
        document.removeEventListener(type, block);
      }
    };
  }, []);
};

const Intro = ({
  onStart,
  view,
}: {
  onStart: () => void;
  view: SessionView;
}) => (
  <Panel title={`Hallo ${view.name}.`}>
    <p>
      Du tippst {view.required} Zeilen. Exakt. Ein falsches Zeichen und die
      Zeile fängt von vorn an. Erst wenn alle Zeilen und der letzte Satz
      geschafft sind, bekommst du deine {view.cans} Dosen. Vorher keine.
    </p>
    <ul className="text-muted list-disc space-y-1 pl-5">
      {view.fadePrompt ? (
        <li>
          Der Satz verschwindet nach drei Sekunden oder beim ersten Tastendruck.
          Merk ihn dir.
        </li>
      ) : null}
      <li>Jede Zeile ist anders.</li>
      {view.hardMode ? (
        <li>Du siehst nur die drei Wörter. Den Satz baust du selbst.</li>
      ) : null}
      <li>
        Alle {ERRORS_PER_PENALTY_LINE} Fehler kommt eine Zeile dazu. Mehr Dosen
        gibt es dafür nicht.
      </li>
      <li>
        15 Sekunden nichts tippen: +{IDLE_PENALTY_LINES} Zeilen. Tab wechseln
        oder Fenster verlassen: +{FOCUS_PENALTY_LINES} Zeilen.
      </li>
      <li>Kein Kopieren, kein Einfügen, kein Löschen.</li>
      <li>
        Neu laden bringt nichts. Alles ist gespeichert, und es zählt als
        Verlassen.
      </li>
      <li>Am Ende kommt noch ein letzter Satz. Ohne Fehler.</li>
    </ul>
    <div>
      <Button onClick={onStart}>Anfangen</Button>
    </div>
  </Panel>
);

const Done = ({ view }: { view: SessionView }) => (
  <Panel title="Geschafft.">
    <p>
      Du hast dir deine {view.cans} Dosen hart erarbeitet. Sie gehören dir.
      Genieß sie.
    </p>
  </Panel>
);

const Prompt = ({ view, visible }: { view: SessionView; visible: boolean }) => (
  <div
    aria-hidden={!visible}
    className={cn(
      "border-border bg-panel flex min-h-36 flex-col justify-center border p-4 transition-opacity duration-500 select-none sm:min-h-44 sm:p-6",
      visible ? "opacity-100" : "opacity-0"
    )}
  >
    {view.phase === "reflection" ? (
      <span className="text-muted mb-3 text-xs tracking-wider uppercase">
        Letzter Satz
      </span>
    ) : null}
    {view.hardMode && view.parts !== null ? (
      <p className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-xl sm:text-3xl">
        <span>{view.parts.slotA}</span>
        <span>{view.parts.slotB}</span>
        <span>{view.parts.title}</span>
      </p>
    ) : (
      <p className="text-xl leading-snug sm:text-3xl">{view.target}</p>
    )}
  </div>
);

const Notices = ({ notices }: { notices: Notice[] }) => (
  <ul aria-live="assertive" className="flex flex-col gap-2">
    {notices.map((notice) => (
      <li
        className="border-danger bg-panel border-l-2 px-3.5 py-2.5 text-sm"
        key={notice.id}
      >
        {notice.text}
      </li>
    ))}
  </ul>
);

const Playing = ({
  notices,
  online,
  send,
  skew,
  view,
}: {
  notices: Notice[];
  online: boolean;
  send: Send;
  skew: number;
  view: SessionView;
}) => {
  const lineKey = `${view.phase}:${view.completed}:${view.errors}`;
  const [hidden, setHidden] = useState({ key: "", value: false });
  const [busy, setBusy] = useState(false);
  const lastKeyAt = useRef(0);
  const away = useRef(false);
  const field = useRef<HTMLInputElement | null>(null);
  const now = useClock(online, skew);

  // A new line always starts visible, so the flag only counts for its line.
  const promptVisible =
    !view.fadePrompt || hidden.key !== lineKey || !hidden.value;

  useIdleAndHeartbeat(online, send, lastKeyAt, away);
  useFocusPenalty(online, send, lastKeyAt, away);

  useEffect(() => {
    lastKeyAt.current = Date.now();
  }, []);

  // Fade the prompt after a few seconds; restarts for each line and peek.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (promptVisible) {
        setHidden({ key: lineKey, value: true });
      }
    }, PROMPT_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [promptVisible, lineKey]);

  const handleKeystroke = useCallback(() => {
    lastKeyAt.current = Date.now();
    setHidden({ key: lineKey, value: true });
  }, [lineKey]);

  const handleError = useCallback(
    (typed: number) => {
      void send({ type: "error", typed });
    },
    [send]
  );

  const handlePaste = useCallback(() => {
    void send({ type: "paste" });
  }, [send]);

  const handleComplete = useCallback(
    (text: string) => {
      setBusy(true);
      void (async () => {
        await send({ index: view.completed, text, type: "line" });
        lastKeyAt.current = Date.now();
        setBusy(false);
      })();
    },
    [send, view.completed]
  );

  const handlePeek = () => {
    void send({ type: "peek" });
    setHidden({ key: lineKey, value: false });
    field.current?.focus();
  };

  return (
    <section className="flex w-full max-w-4xl flex-col gap-8">
      <StatGrid>
        <Stat label="Zeilen geschafft" value={view.completed.toString()} />
        <Stat label="Noch offen" value={view.remaining.toString()} />
        <Stat label="Fehler" value={view.errors.toString()} />
        <Stat
          label="Zeit"
          value={formatDuration(now - (view.startedAt ?? now))}
        />
      </StatGrid>
      <Prompt view={view} visible={promptVisible} />
      <div
        className={cn("w-full", view.errors > 0 && "animate-shake")}
        key={view.errors}
      >
        <TypingField
          disabled={busy || !online}
          key={lineKey}
          onComplete={handleComplete}
          onError={handleError}
          onKeystroke={handleKeystroke}
          onPaste={handlePaste}
          ref={field}
          target={view.target}
        />
      </div>
      <div className="flex min-h-6 items-center justify-between">
        {view.fadePrompt ? (
          <Button disabled={promptVisible} onClick={handlePeek} variant="link">
            Nochmal zeigen (+{PEEK_PENALTY_LINES} Zeile)
          </Button>
        ) : (
          <span />
        )}
        {online ? null : (
          <span className="text-danger text-sm">Keine Verbindung.</span>
        )}
      </div>
      <Notices notices={notices} />
    </section>
  );
};

/**
 * The whole player experience for one session link.
 * @param props - The session id from the URL.
 * @returns The current screen.
 */
export const Game = ({ id }: { id: string }) => {
  const { claim, notices, send, skew, status, view } = useSession(id);

  useNoClipboard();

  if (status === "missing") {
    return <Panel title="Diese Sitzung gibt es nicht." />;
  }

  if (status === "taken") {
    return (
      <Panel title="Diese Sitzung ist in einem anderen Tab offen.">
        <div>
          <Button
            onClick={() => {
              void claim();
            }}
          >
            Hier weitermachen
          </Button>
        </div>
      </Panel>
    );
  }

  if (view === null) {
    return (
      <Panel title={status === "offline" ? "Keine Verbindung." : "Lädt …"} />
    );
  }

  if (view.phase === "pending") {
    return (
      <Intro
        onStart={() => {
          void send({ type: "start" });
        }}
        view={view}
      />
    );
  }

  if (view.phase === "done") {
    return <Done view={view} />;
  }

  return (
    <Playing
      notices={notices}
      online={status === "ready"}
      send={send}
      skew={skew}
      view={view}
    />
  );
};
