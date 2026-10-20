const pad = (n: number): string => n.toString().padStart(2, "0");

/**
 * Formats a duration as `mm:ss`, or `h:mm:ss` from one hour on.
 * @param ms - Duration in milliseconds.
 * @returns The formatted duration.
 */
export const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Formats a ratio as a German percentage, e.g. `97,3 %`.
 * @param ratio - A value between 0 and 1.
 * @returns The formatted percentage.
 */
export const formatPercent = (ratio: number): string =>
  `${(ratio * 100).toFixed(1).replace(".", ",")} %`;
