import { z } from "zod";

import { ADMIN_COOKIE, adminToken, isAdminSecret } from "@/lib/admin";
import { parseBody } from "@/lib/http";

const loginSchema = z.object({ secret: z.string().max(200) });

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Checks the password and sets an HttpOnly cookie with a hash of it.
 * @param request - Body is `{ secret }`.
 * @returns 200 with the cookie, or 401.
 */
const login = async (request: Request): Promise<Response> => {
  const parsed = await parseBody(request, loginSchema);

  if (!parsed.success || !isAdminSecret(parsed.data.secret)) {
    return Response.json({ error: "Falsches Passwort." }, { status: 401 });
  }

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";

  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${ADMIN_COOKIE}=${adminToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${THIRTY_DAYS}${secure}`,
      },
    }
  );
};

export { login as POST };
