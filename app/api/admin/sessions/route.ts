import { z } from "zod";

import { isAdmin, newSessionId } from "@/lib/admin";
import { parseBody } from "@/lib/http";
import { DEFAULT_TARGET_CANS, MAX_TARGET_CANS } from "@/lib/rules";
import { createSession } from "@/lib/session";
import { store } from "@/lib/store";
import { summarize } from "@/lib/summary";
import { isDiscordWebhook } from "@/lib/webhook";

const createSchema = z.object({
  hardMode: z.boolean().default(false),
  name: z.string().trim().min(1, "Name fehlt.").max(60),
  targetCans: z
    .number()
    .int()
    .min(1)
    .max(MAX_TARGET_CANS)
    .default(DEFAULT_TARGET_CANS),
  webhookUrl: z
    .string()
    .trim()
    .max(300)
    .refine((url) => url === "" || isDiscordWebhook(url), {
      message: "Keine gültige Discord-Webhook-URL.",
    })
    .default(""),
});

const credentials = (request: Request) => ({
  authorization: request.headers.get("authorization"),
  cookie: request.headers.get("cookie"),
});

/**
 * Lists all sessions, newest first. Also usable with
 * `Authorization: Bearer <ADMIN_SECRET>` from scripts.
 * @param request - The incoming request.
 * @returns The session summaries, or 401.
 */
const listSessions = async (request: Request): Promise<Response> => {
  if (!isAdmin(credentials(request))) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { origin } = new URL(request.url);
  const sessions = await store().list();

  return Response.json({
    sessions: sessions.map((s) => summarize(s, origin, Date.now())),
  });
};

/**
 * Creates a session and returns its unique link.
 * @param request - Body is `{ name, targetCans, hardMode, webhookUrl }`.
 * @returns The new session summary including its URL, 400, or 401.
 */
const createNewSession = async (request: Request): Promise<Response> => {
  if (!isAdmin(credentials(request))) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const parsed = await parseBody(request, createSchema);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültige Eingabe.";

    return Response.json({ error: message }, { status: 400 });
  }

  const { hardMode, name, targetCans, webhookUrl } = parsed.data;

  const session = createSession({
    hardMode,
    id: newSessionId(),
    name,
    now: Date.now(),
    targetCans,
    webhookUrl: webhookUrl === "" ? null : webhookUrl,
  });

  await store().put(session);

  const { origin } = new URL(request.url);

  return Response.json(
    { session: summarize(session, origin, Date.now()) },
    { status: 201 }
  );
};

export { createNewSession as POST, listSessions as GET };
