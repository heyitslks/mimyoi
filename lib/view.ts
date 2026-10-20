import { z } from "zod";

/** Where a session currently stands. */
export const phaseSchema = z.enum(["pending", "lines", "reflection", "done"]);

/** Where a session currently stands. */
export type Phase = z.infer<typeof phaseSchema>;

/** What the player's browser gets to see. */
export const viewSchema = z.object({
  accuracy: z.number(),
  /** Cans awarded at once when everything is done. Penalties never add cans. */
  cans: z.number(),
  completed: z.number(),
  errors: z.number(),
  fadePrompt: z.boolean(),
  finishedAt: z.number().nullable(),
  hardMode: z.boolean(),
  name: z.string(),
  now: z.number(),
  parts: z
    .object({ slotA: z.string(), slotB: z.string(), title: z.string() })
    .nullable(),
  penalties: z.number(),
  phase: phaseSchema,
  remaining: z.number(),
  required: z.number(),
  startedAt: z.number().nullable(),
  target: z.string(),
});

/** What the player's browser gets to see. */
export type SessionView = z.infer<typeof viewSchema>;

/** Response body of every session API call. */
export const payloadSchema = z.object({
  notices: z.array(z.string()),
  view: viewSchema,
});

/** What the admin page gets to see per session. */
export const summarySchema = z.object({
  absences: z.number(),
  accuracy: z.number(),
  completed: z.number(),
  createdAt: z.number(),
  elapsed: z.number().nullable(),
  errors: z.number(),
  fadePrompt: z.boolean(),
  finishedAt: z.number().nullable(),
  focusLosses: z.number(),
  hardMode: z.boolean(),
  hasWebhook: z.boolean(),
  id: z.string(),
  idles: z.number(),
  name: z.string(),
  peeks: z.number(),
  penalties: z.number(),
  phase: phaseSchema,
  startedAt: z.number().nullable(),
  targetCans: z.number(),
  tooFast: z.number(),
  url: z.string(),
});

/** What the admin page gets to see per session. */
export type SessionSummary = z.infer<typeof summarySchema>;
