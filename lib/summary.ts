import { accuracyOf, penaltyLines, phaseOf } from "./session";
import type { Session } from "./session";
import type { SessionSummary } from "./view";

/**
 * Admin view of a session. Leaves out the webhook URL itself.
 * @param s - The session.
 * @param origin - Origin of the current request, to build the player link.
 * @param now - Current time, for the running clock.
 * @returns The summary row.
 */
export const summarize = (
  s: Session,
  origin: string,
  now: number
): SessionSummary => ({
  absences: s.absences,
  accuracy: accuracyOf(s),
  completed: s.completed,
  createdAt: s.createdAt,
  elapsed: s.startedAt === null ? null : (s.finishedAt ?? now) - s.startedAt,
  errors: s.errors,
  fadePrompt: s.fadePrompt,
  finishedAt: s.finishedAt,
  focusLosses: s.focusLosses,
  hardMode: s.hardMode,
  hasWebhook: s.webhookUrl !== null,
  id: s.id,
  idles: s.idles,
  name: s.name,
  peeks: s.peeks,
  penalties: penaltyLines(s),
  phase: phaseOf(s),
  startedAt: s.startedAt,
  targetCans: s.targetCans,
  tooFast: s.tooFast,
  url: `${origin}/s/${s.id}`,
});
