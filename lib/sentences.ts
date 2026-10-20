const SLOT_A = ["Energydrinks", "Koffein", "Treats", "Extras", "Komfort"];

const SLOT_B = [
  "unverdientes",
  "vorübergehendes",
  "bedingtes",
  "reines",
  "bloßes",
];

const TITLES = ["Sir", "Master", "meinem Meister"];

/** The last line, typed once after all cans are earned. */
export const REFLECTION_LINE =
  "Ich habe diese Dosen nicht verdient. Sie sind ein Privileg.";

/** The three rotating values that make up one line. */
export interface LineParts {
  slotA: string;
  slotB: string;
  title: string;
}

const pick = (list: readonly string[], index: number): string =>
  list[index % list.length] ?? "";

/**
 * All three rotations advance together after every completed line.
 * @param index - Number of lines completed so far.
 * @returns The slot values for that line.
 */
export const partsForLine = (index: number): LineParts => ({
  slotA: pick(SLOT_A, index),
  slotB: pick(SLOT_B, index),
  title: pick(TITLES, index),
});

/**
 * Builds the exact sentence that has to be typed.
 * @param index - Number of lines completed so far.
 * @returns The full target sentence.
 */
export const lineFor = (index: number): string => {
  const { slotA, slotB, title } = partsForLine(index);

  return `Ich habe kein Recht auf ${slotA}. Alles, was ich habe, ist ein ${slotB} Privileg von ${title}.`;
};
