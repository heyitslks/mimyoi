declare namespace NodeJS {
  interface ProcessEnv {
    /** Password for /admin. */
    readonly ADMIN_SECRET?: string;
    /** Set by the Upstash for Redis integration on Vercel. */
    readonly KV_REST_API_TOKEN?: string;
    readonly KV_REST_API_URL?: string;
    /** Alternative names when connecting Upstash directly. */
    readonly UPSTASH_REDIS_REST_TOKEN?: string;
    readonly UPSTASH_REDIS_REST_URL?: string;
  }
}
