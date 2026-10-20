# Mimi

A strict German typing task. Every exactly typed line earns one can. One wrong character restarts the line, and errors, idling, leaving the tab and peeking all add extra lines. All state lives on the server, so reloading or closing the page changes nothing.

## How it works

1. Open `/admin`, log in with `ADMIN_SECRET`, enter a name, the number of cans, and optionally a Discord webhook, the fading prompt and hard mode.
2. You get a unique link like `https://your-app.vercel.app/s/k3Fq…`. Send it.
3. Watch progress on `/admin`. The webhook posts when the session starts and when it finishes, with the final stats.

### Rules (enforced on the server)

| What | Effect |
| --- | --- |
| One line | `Ich habe kein Recht auf [A]. Alles, was ich habe, ist ein [B] Privileg von [Titel].` All three slots rotate after every completed line. |
| Wrong character, paste attempt, or a line typed faster than humanly possible | Counts as an error, the line restarts |
| Every 2 errors | +1 line |
| 15 s without a keystroke | +2 lines |
| Leaving the tab or window (reload included), or 20 s without any ping | +2 lines |
| Fading prompt (optional, off by default) | The sentence disappears after 3 s or on the first keystroke. "Nochmal zeigen" shows it again for +1 line. |
| Final line | `Ich habe diese Dosen nicht verdient. Sie sind ein Privileg.` must be typed perfectly. Penalties earned during it send you back to lines. |

Hard mode (checkbox on `/admin`) shows only the three slot values; the sentence has to be built from memory. Only the most recently opened tab can play; older tabs get locked out.

## Deploy on Vercel

1. Import the repository in Vercel.
2. In the project, open **Storage → Create Database → Upstash for Redis** and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add the environment variable `ADMIN_SECRET` (a long random password).
4. Redeploy, then open `/admin`.

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `ADMIN_SECRET` | yes | Password for `/admin`. Without it, admin is disabled. |
| `KV_REST_API_URL` | in production | Set by the Upstash integration. `UPSTASH_REDIS_REST_URL` works too. |
| `KV_REST_API_TOKEN` | in production | Set by the Upstash integration. `UPSTASH_REDIS_REST_TOKEN` works too. |

Discord webhooks are set per session on `/admin` (Discord: Server settings → Integrations → Webhooks → Copy Webhook URL). Only `discord.com/api/webhooks/…` URLs are accepted.

### API (optional)

```sh
# Create a session
curl -X POST https://your-app.vercel.app/api/admin/sessions \
  -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" \
  -d '{"name":"Mimi","targetCans":20,"hardMode":false,"webhookUrl":""}'

# List sessions with stats
curl https://your-app.vercel.app/api/admin/sessions \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

## Development

```sh
npm install
cp .env.example .env.local   # set ADMIN_SECRET; leave Redis empty for an in-memory store
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run lint` | Ultracite (Oxlint + Oxfmt), type-aware, with every Oxlint JS plugin Ultracite offers |
| `npm run fix` | Auto-fixes lint and formatting |
| `npm run typecheck` | `tsc` with the strictest compiler flags |
| `npm run build` | Production build |
