import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie set by the admin login. */
export const ADMIN_COOKIE = "mimi_admin";

const digest = (value: string): Buffer =>
  createHash("sha256").update(`mimi:${value}`).digest();

const sameValue = (a: string, b: string): boolean =>
  timingSafeEqual(digest(a), digest(b));

const secret = (): string => process.env.ADMIN_SECRET ?? "";

/**
 * Checks a password against ADMIN_SECRET.
 * @param candidate - The entered password.
 * @returns Whether it matches. Always false when ADMIN_SECRET is unset.
 */
export const isAdminSecret = (candidate: string): boolean =>
  secret() !== "" && sameValue(candidate, secret());

/**
 * The cookie stores a hash of the secret, never the secret itself.
 * @returns The cookie value for a logged-in admin.
 */
export const adminToken = (): string => digest(secret()).toString("hex");

const cookieValue = (cookies: string): string => {
  const match = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));

  return match?.slice(ADMIN_COOKIE.length + 1) ?? "";
};

/**
 * Accepts the login cookie or `Authorization: Bearer <ADMIN_SECRET>`.
 * @param credentials - Raw Authorization and Cookie header values.
 * @returns Whether the request comes from the admin.
 */
export const isAdmin = (credentials: {
  authorization: string | null;
  cookie: string | null;
}): boolean => {
  if (secret() === "") {
    return false;
  }

  const bearer = (credentials.authorization ?? "").replace(/^Bearer\s+/iu, "");

  if (bearer !== "" && isAdminSecret(bearer)) {
    return true;
  }

  return sameValue(cookieValue(credentials.cookie ?? ""), adminToken());
};

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Unguessable session id; the link is the only key to the session.
 * @returns A 16 character id.
 */
export const newSessionId = (): string =>
  Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(
    ""
  );
