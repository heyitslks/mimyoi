import "server-only";
import { formatDuration, formatPercent } from "./format";
import {
  FOCUS_PENALTY_LINES,
  IDLE_PENALTY_LINES,
  PEEK_PENALTY_LINES,
} from "./rules";
import { accuracyOf, penaltyLines, requiredLines } from "./session";
import type { Session, Signal } from "./session";

const DISCORD_WEBHOOK =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/u;

/**
 * Only Discord webhooks are accepted, so the server never posts elsewhere.
 * @param url - The URL entered on the admin page.
 * @returns Whether it is a Discord webhook URL.
 */
export const isDiscordWebhook = (url: string): boolean =>
  DISCORD_WEBHOOK.test(url);

const summaryFor = (s: Session): string => {
  const time = formatDuration((s.finishedAt ?? 0) - (s.startedAt ?? 0));

  return [
    `🥤 **${s.name}** ist fertig und bekommt ${s.targetCans} Dosen.`,
    `Zeit: ${time}`,
    `Zeilen getippt: ${s.completed} (davon ${penaltyLines(s)} Strafzeilen)`,
    `Fehler: ${s.errors} · Genauigkeit: ${formatPercent(accuracyOf(s))}`,
    `Leerlauf: ${s.idles + s.absences} · Seite verlassen: ${s.focusLosses} · Nachgeschaut: ${s.peeks}`,
  ].join("\n");
};

const lineFor = (s: Session, signal: Signal): string => {
  const name = `**${s.name}**`;

  switch (signal.kind) {
    case "absent": {
      return `📴 ${name} war ohne Verbindung weg. +${IDLE_PENALTY_LINES} Zeilen.`;
    }

    case "back": {
      return `↩️ ${name} ist zurück (${formatDuration(signal.awayMs)} weg).`;
    }

    case "finished": {
      return summaryFor(s);
    }

    case "idle": {
      return `💤 ${name} hat 15 Sekunden nichts getippt. +${IDLE_PENALTY_LINES} Zeilen.`;
    }

    case "left": {
      return `👀 ${name} hat die Seite verlassen. +${FOCUS_PENALTY_LINES} Zeilen.`;
    }

    case "line": {
      return `✅ ${name}: Zeile ${s.completed} von ${requiredLines(s)} geschafft.`;
    }

    case "paste": {
      return `📋 ${name} hat versucht, etwas einzufügen. Zählt als Fehler.`;
    }

    case "peek": {
      return `🔁 ${name} hat nochmal nachgeschaut. +${PEEK_PENALTY_LINES} Zeile.`;
    }

    case "penalty": {
      return `❌ ${name} hat jetzt ${s.errors} Fehler. Eine Zeile mehr.`;
    }

    case "reflection": {
      return `🏁 ${name} hat alle Zeilen geschafft. Jetzt fehlt nur noch der letzte Satz.`;
    }

    case "started": {
      return `▶️ ${name} hat angefangen. Ziel: ${s.targetCans} Dosen.`;
    }

    case "tooFast": {
      return `⚡ ${name} war zu schnell, um echt zu sein. Zählt als Fehler.`;
    }

    default: {
      return "";
    }
  }
};

/**
 * Posts what just happened to the session's Discord webhook, if it has one.
 * All signals of one event go out as a single message, which keeps well
 * under Discord's rate limit. Best effort: a broken webhook must never
 * break the session.
 * @param s - The session after the event.
 * @param signals - What just happened.
 */
export const notify = async (s: Session, signals: Signal[]): Promise<void> => {
  if (s.webhookUrl === null || signals.length === 0) {
    return;
  }

  try {
    await fetch(s.webhookUrl, {
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        content: signals.map((signal) => lineFor(s, signal)).join("\n"),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Discord webhook failed", error);
  }
};
