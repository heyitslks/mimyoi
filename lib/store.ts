import "server-only";
import { Redis } from "@upstash/redis";

import { sessionSchema } from "./session";
import type { Session } from "./session";

const SESSION_PREFIX = "mimi:session:";
const INDEX_KEY = "mimi:sessions";

interface Store {
  get: (id: string) => Promise<Session | null>;
  list: () => Promise<Session[]>;
  put: (session: Session) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const redisStore = (redis: Redis): Store => ({
  get: async (id) => {
    const result = sessionSchema.safeParse(
      await redis.get(SESSION_PREFIX + id)
    );

    return result.success ? result.data : null;
  },
  list: async () => {
    const ids = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });

    if (ids.length === 0) {
      return [];
    }

    const raws = await redis.mget(...ids.map((id) => SESSION_PREFIX + id));

    return raws.flatMap((raw) => {
      const result = sessionSchema.safeParse(raw);

      return result.success ? [result.data] : [];
    });
  },
  put: async (session) => {
    await redis
      .pipeline()
      .set(SESSION_PREFIX + session.id, session)
      .zadd(INDEX_KEY, { member: session.id, score: session.createdAt })
      .exec();
  },
  remove: async (id) => {
    await redis
      .pipeline()
      .del(SESSION_PREFIX + id)
      .zrem(INDEX_KEY, id)
      .exec();
  },
});

// Local development only, so the app runs without a database.
const memoryStore = (): Store => {
  const sessions = new Map<string, Session>();

  return {
    get: async (id) => await Promise.resolve(sessions.get(id) ?? null),
    list: async () =>
      await Promise.resolve(
        [...sessions.values()].toSorted((a, b) => b.createdAt - a.createdAt)
      ),
    put: async (session) => {
      sessions.set(session.id, session);
      await Promise.resolve();
    },
    remove: async (id) => {
      sessions.delete(id);
      await Promise.resolve();
    },
  };
};

const createStore = (): Store => {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";

  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

  if (url !== "" && token !== "") {
    return redisStore(new Redis({ token, url }));
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing KV_REST_API_URL / KV_REST_API_TOKEN. Connect Upstash Redis to the Vercel project."
    );
  }

  console.warn("No Redis configured, using an in-memory store.");

  return memoryStore();
};

declare global {
  // Shared by all server bundles (pages and route handlers) in one process.
  // oxlint-disable-next-line no-var -- `declare global` requires `var`
  var mimiStore: Store | undefined;
}

/**
 * Redis when configured, otherwise an in-memory store for local development.
 * @returns The session store.
 */
export const store = (): Store => {
  globalThis.mimiStore ??= createStore();

  return globalThis.mimiStore;
};
