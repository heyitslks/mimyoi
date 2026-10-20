import type { z } from "zod";

/**
 * Reads a JSON body and validates it, without throwing on malformed input.
 * @param request - The incoming request.
 * @param schema - Expected shape of the body.
 * @returns The parse result; a broken body is reported as a failed parse.
 */
export const parseBody = async <T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<z.ZodSafeParseResult<T>> => {
  try {
    return schema.safeParse(await request.json());
  } catch {
    return schema.safeParse(null);
  }
};
