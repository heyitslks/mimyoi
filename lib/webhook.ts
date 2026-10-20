import "server-only";
import { formatDuration, formatPercent } from "./format";
import { accuracyOf, penaltyLines } from "./session";
import type { Outcome, Session } from "./session";

const DISCORD_WEBHOOK =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/u;

/**
 * Only Discord webhooks are accepted, so the server never posts elsewhere.
 * @param url - The URL entered on the admin page.
 * @returns Whether it is a Discord webhook URL.
 */
export const isDiscordWebhook = (url: string): boolean =>
  DISCORD_WEBHOOK.test(url);

const messageFor = (s: Session, outcome: Exclude<Outcome, null>): string => {
  if (outcome === "started") {
    return `**${s.name}** hat angefangen. Ziel: ${s.targetCans} Dosen.`;
  }

  const time = formatDuration((s.finishedAt ?? 0) - (s.startedAt ?? 0));

  return [
    `**${s.name}** ist fertig.`,
    `Zeit: ${time}`,
    `Zeilen: ${s.completed} (davon ${penaltyLines(s)} Strafzeilen)`,
    `Fehler: ${s.errors} · Genauigkeit: ${formatPercent(accuracyOf(s))}`,
    `Leerlauf: ${s.idles + s.absences} · Seite verlassen: ${s.focusLosses} · Nachgeschaut: ${s.peeks}`,
  ].join("\n");
};

/**
 * Posts start and finish to the session's Discord webhook, if it has one.
 * Best effort: a broken webhook must never break the session.
 * @param s - The session after the event.
 * @param outcome - What just happened.
 */
export const notify = async (
  s: Session,
  outcome: Exclude<Outcome, null>
): Promise<void> => {
  if (s.webhookUrl === null) {
    return;
  }

  try {
    await fetch(s.webhookUrl, {
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        content: messageFor(s, outcome),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Discord webhook failed", error);
  }
};
