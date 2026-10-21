import { after } from "next/server";

import { parseBody } from "@/lib/http";
import { applyEvent, eventSchema, toView } from "@/lib/session";
import { store } from "@/lib/store";
import { notify } from "@/lib/webhook";

/**
 * Applies one event from the player's browser and returns the new view.
 * The server decides everything; the browser only reports what happened.
 * @param request - Body is a session event.
 * @param context - Route params with the session id.
 * @returns The new view plus notices, 404, or 409 if another tab owns it.
 */
const handleEvent = async (
  request: Request,
  context: RouteContext<"/api/sessions/[id]">
): Promise<Response> => {
  const [{ id }, parsed] = await Promise.all([
    context.params,
    parseBody(request, eventSchema),
  ]);

  if (!parsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const event = parsed.data;
  const session = await store().get(id);

  if (session === null) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Only the most recently opened tab may play.
  if (event.type !== "hello" && session.clientId !== event.clientId) {
    return Response.json({ error: "taken" }, { status: 409 });
  }

  const now = Date.now();
  const { notices, session: next, signals } = applyEvent(session, event, now);

  await store().put(next);

  if (signals.length > 0) {
    after(async () => {
      await notify(next, signals);
    });
  }

  return Response.json({ notices, view: toView(next, now) });
};

export { handleEvent as POST };
