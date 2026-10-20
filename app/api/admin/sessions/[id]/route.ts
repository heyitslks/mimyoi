import { isAdmin } from "@/lib/admin";
import { store } from "@/lib/store";

/**
 * Deletes a session for good. Its link stops working right away.
 * @param request - The incoming request.
 * @param context - Route params with the session id.
 * @returns 204, or 401 when not logged in.
 */
const deleteSession = async (
  request: Request,
  context: RouteContext<"/api/admin/sessions/[id]">
): Promise<Response> => {
  const isAllowed = isAdmin({
    authorization: request.headers.get("authorization"),
    cookie: request.headers.get("cookie"),
  });

  if (!isAllowed) {
    return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { id } = await context.params;

  await store().remove(id);

  return new Response(null, { status: 204 });
};

export { deleteSession as DELETE };
