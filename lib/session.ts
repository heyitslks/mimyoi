import { z } from "zod";

import {
  ABSENCE_MS,
  ERRORS_PER_PENALTY_LINE,
  FOCUS_PENALTY_LINES,
  IDLE_MS,
  IDLE_PENALTY_LINES,
  MIN_MS_PER_CHAR,
  PEEK_PENALTY_LINES,
} from "./rules";
import { REFLECTION_LINE, lineFor, partsForLine } from "./sentences";
import type { Phase, SessionView } from "./view";

/** Full server-side state of one session, as stored in Redis. */
export const sessionSchema = z.object({
  absences: z.number().int().nonnegative(),
  away: z.boolean(),
  clientId: z.string().nullable(),
  completed: z.number().int().nonnegative(),
  correctChars: z.number().int().nonnegative(),
  createdAt: z.number(),
  errors: z.number().int().nonnegative(),
  // Sessions created before this option existed keep the prompt visible.
  fadePrompt: z.boolean().default(false),
  finishedAt: z.number().nullable(),
  focusLosses: z.number().int().nonnegative(),
  hardMode: z.boolean(),
  id: z.string(),
  idles: z.number().int().nonnegative(),
  lastIdleAt: z.number(),
  lastSeenAt: z.number(),
  lineStartedAt: z.number(),
  name: z.string(),
  peeks: z.number().int().nonnegative(),
  startedAt: z.number().nullable(),
  targetCans: z.number().int().positive(),
  tooFast: z.number().int().nonnegative(),
  webhookUrl: z.string().nullable(),
});

/** Full server-side state of one session, as stored in Redis. */
export type Session = z.infer<typeof sessionSchema>;

const clientId = z.string().min(8).max(64);

/** Everything the browser can report. The server decides what it means. */
export const eventSchema = z.discriminatedUnion("type", [
  z.object({ clientId, type: z.literal("hello") }),
  z.object({ clientId, type: z.literal("start") }),
  z.object({ clientId, type: z.literal("beat") }),
  z.object({ clientId, type: z.literal("idle") }),
  z.object({ clientId, type: z.literal("blur") }),
  z.object({ clientId, type: z.literal("peek") }),
  z.object({ clientId, type: z.literal("paste") }),
  z.object({
    clientId,
    type: z.literal("error"),
    typed: z.number().int().nonnegative(),
  }),
  z.object({
    clientId,
    index: z.number().int().nonnegative(),
    text: z.string().max(500),
    type: z.literal("line"),
  }),
]);

/** Everything the browser can report. The server decides what it means. */
export type SessionEvent = z.infer<typeof eventSchema>;

/** Side effect to trigger after an event was stored. */
export type Outcome = "started" | "finished" | null;

/** Result of applying one event. */
export interface Applied {
  notices: string[];
  outcome: Outcome;
  session: Session;
}

/**
 * A fresh, not yet started session.
 * @param input - Settings chosen on the admin page.
 * @returns The new session.
 */
export const createSession = (input: {
  fadePrompt: boolean;
  hardMode: boolean;
  id: string;
  name: string;
  now: number;
  targetCans: number;
  webhookUrl: string | null;
}): Session => ({
  absences: 0,
  away: false,
  clientId: null,
  completed: 0,
  correctChars: 0,
  createdAt: input.now,
  errors: 0,
  fadePrompt: input.fadePrompt,
  finishedAt: null,
  focusLosses: 0,
  hardMode: input.hardMode,
  id: input.id,
  idles: 0,
  lastIdleAt: 0,
  lastSeenAt: input.now,
  lineStartedAt: input.now,
  name: input.name,
  peeks: 0,
  startedAt: null,
  targetCans: input.targetCans,
  tooFast: 0,
  webhookUrl: input.webhookUrl,
});

/**
 * Extra lines earned through errors, idling, leaving and peeking.
 * Penalties only ever add up, they never go away.
 * @param s - The session.
 * @returns Number of penalty lines.
 */
export const penaltyLines = (s: Session): number =>
  Math.floor(s.errors / ERRORS_PER_PENALTY_LINE) +
  (s.idles + s.absences) * IDLE_PENALTY_LINES +
  s.focusLosses * FOCUS_PENALTY_LINES +
  s.peeks * PEEK_PENALTY_LINES;

const requiredLines = (s: Session): number => s.targetCans + penaltyLines(s);

/**
 * Derives the phase from the counters, so it can never drift out of sync.
 * @param s - The session.
 * @returns The current phase.
 */
export const phaseOf = (s: Session): Phase => {
  if (s.startedAt === null) {
    return "pending";
  }

  if (s.finishedAt !== null) {
    return "done";
  }

  return s.completed < requiredLines(s) ? "lines" : "reflection";
};

/**
 * Share of keystrokes that were correct.
 * @param s - The session.
 * @returns A ratio between 0 and 1.
 */
export const accuracyOf = (s: Session): number => {
  const total = s.correctChars + s.errors;

  return total === 0 ? 1 : s.correctChars / total;
};

const targetOf = (s: Session): string =>
  phaseOf(s) === "reflection" ? REFLECTION_LINE : lineFor(s.completed);

const isRunning = (s: Session): boolean => {
  const phase = phaseOf(s);

  return phase === "lines" || phase === "reflection";
};

const unchanged = (session: Session, notices: string[] = []): Applied => ({
  notices,
  outcome: null,
  session,
});

const addError = (s: Session, typed: number, now: number): Session => ({
  ...s,
  correctChars: s.correctChars + Math.min(typed, targetOf(s).length),
  errors: s.errors + 1,
  lineStartedAt: now,
});

const errorNotice = (s: Session): string[] =>
  s.errors % ERRORS_PER_PENALTY_LINE === 0
    ? [`${ERRORS_PER_PENALTY_LINE} Fehler. Eine Zeile mehr.`]
    : [];

// Counts a gap with no ping at all (tab killed, phone locked) as leaving.
const checkAbsence = (s: Session, now: number): Applied => {
  if (!isRunning(s) || s.away || now - s.lastSeenAt <= ABSENCE_MS) {
    return unchanged(s);
  }

  return unchanged({ ...s, absences: s.absences + 1, lineStartedAt: now }, [
    `Du warst weg. +${IDLE_PENALTY_LINES} Zeilen.`,
  ]);
};

const submitLine = (
  s: Session,
  index: number,
  text: string,
  now: number
): Applied => {
  const phase = phaseOf(s);

  // A retried request for a line that already counted.
  if (phase === "lines" && index !== s.completed) {
    return unchanged(s);
  }

  const target = targetOf(s);

  if (text !== target) {
    return unchanged(addError(s, 0, now), ["Falsch. Von vorn."]);
  }

  if (now - s.lineStartedAt < target.length * MIN_MS_PER_CHAR) {
    return unchanged({ ...addError(s, 0, now), tooFast: s.tooFast + 1 }, [
      "Zu schnell, um echt zu sein. Zählt als Fehler.",
    ]);
  }

  const counted: Session = {
    ...s,
    correctChars: s.correctChars + target.length,
    lineStartedAt: now,
  };

  if (phase === "reflection") {
    return {
      notices: [],
      outcome: "finished",
      session: { ...counted, finishedAt: now },
    };
  }

  return unchanged({ ...counted, completed: s.completed + 1 });
};

const applyRunning = (
  s: Session,
  event: SessionEvent,
  now: number
): Applied => {
  switch (event.type) {
    case "blur": {
      if (s.away) {
        return unchanged(s);
      }

      return unchanged({ ...s, away: true, focusLosses: s.focusLosses + 1 }, [
        `Du hast die Seite verlassen. +${FOCUS_PENALTY_LINES} Zeilen.`,
      ]);
    }

    case "idle": {
      if (now - s.lastIdleAt < IDLE_MS - 2000) {
        return unchanged(s);
      }

      return unchanged({ ...s, idles: s.idles + 1, lastIdleAt: now }, [
        `15 Sekunden nichts getippt. +${IDLE_PENALTY_LINES} Zeilen.`,
      ]);
    }

    case "peek": {
      // Nothing to peek at when the prompt never fades.
      if (!s.fadePrompt) {
        return unchanged(s);
      }

      return unchanged({ ...s, peeks: s.peeks + 1 }, [
        `Nochmal angeschaut. +${PEEK_PENALTY_LINES} Zeile.`,
      ]);
    }

    case "paste": {
      const next = addError(s, 0, now);

      return unchanged(next, [
        "Einfügen ist nicht erlaubt.",
        ...errorNotice(next),
      ]);
    }

    case "error": {
      const next = addError(s, event.typed, now);

      return unchanged(next, errorNotice(next));
    }

    case "line": {
      return submitLine(s, event.index, event.text, now);
    }

    case "beat":
    case "hello":
    case "start": {
      return unchanged(s);
    }

    default: {
      return unchanged(s);
    }
  }
};

/**
 * Pure state transition. The server is the only place this runs.
 * @param current - The stored session.
 * @param event - What the browser reported.
 * @param now - Server time in milliseconds.
 * @returns The next session plus notices for the player.
 */
export const applyEvent = (
  current: Session,
  event: SessionEvent,
  now: number
): Applied => {
  const claimed =
    event.type === "hello" ? { ...current, clientId: event.clientId } : current;

  const absence = checkAbsence(claimed, now);

  const seen: Session = {
    ...absence.session,
    away: event.type === "blur" ? absence.session.away : false,
    lastSeenAt: now,
  };

  if (event.type === "start") {
    if (seen.startedAt !== null) {
      return unchanged(seen);
    }

    return {
      notices: [],
      outcome: "started",
      session: { ...seen, lastIdleAt: now, lineStartedAt: now, startedAt: now },
    };
  }

  if (!isRunning(seen)) {
    return unchanged(seen, absence.notices);
  }

  const applied = applyRunning(seen, event, now);

  return { ...applied, notices: [...absence.notices, ...applied.notices] };
};

/**
 * Strips everything the player should not see.
 * @param s - The session.
 * @param now - Server time, so the browser can correct its clock.
 * @returns The view for the player's browser.
 */
export const toView = (s: Session, now: number): SessionView => {
  const phase = phaseOf(s);
  const required = requiredLines(s);

  return {
    accuracy: accuracyOf(s),
    completed: s.completed,
    errors: s.errors,
    fadePrompt: s.fadePrompt,
    finishedAt: s.finishedAt,
    hardMode: s.hardMode,
    name: s.name,
    now,
    parts: phase === "lines" ? partsForLine(s.completed) : null,
    penalties: penaltyLines(s),
    phase,
    remaining: Math.max(0, required - s.completed),
    required,
    startedAt: s.startedAt,
    target: targetOf(s),
  };
};
