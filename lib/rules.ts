/** No keystroke for this long counts as idling. */
export const IDLE_MS = 15_000;

/** How long the prompt stays visible before it fades. */
export const PROMPT_VISIBLE_MS = 3000;

/** The client pings this often while the page is open and visible. */
export const HEARTBEAT_MS = 5000;

/** A gap without any ping longer than this counts as having left the page. */
export const ABSENCE_MS = 20_000;

/** Every this many errors adds one extra required line. */
export const ERRORS_PER_PENALTY_LINE = 2;

export const IDLE_PENALTY_LINES = 2;

export const FOCUS_PENALTY_LINES = 2;

export const PEEK_PENALTY_LINES = 1;

/**
 * Faster than this per character is not human typing (about 340 words per
 * minute), so the line is rejected as an error.
 */
export const MIN_MS_PER_CHAR = 35;

export const DEFAULT_TARGET_CANS = 10;

export const MAX_TARGET_CANS = 500;
