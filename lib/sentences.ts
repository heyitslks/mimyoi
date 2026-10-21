const SLOT_A = ["Energydrinks", "Koffein", "Treats", "Extras", "Komfort"];

const SLOT_B = [
  "unverdientes",
  "vorübergehendes",
  "bedingtes",
  "reines",
  "bloßes",
];

const TITLES = ["Sir", "Master", "meinem Meister"];

// Who the line is about, with the matching pronoun for the second sentence.
const SUBJECTS = [
  { has: "habe", pronoun: "ich", subject: "Ich" },
  { has: "hat", pronoun: "es", subject: "Dieses Pet" },
  { has: "hat", pronoun: "sie", subject: "Diese Sub" },
] as const;

/** The last line, typed once after all cans are earned. */
export const REFLECTION_LINE =
  "Ich habe diese Dosen nicht verdient. Sie sind ein Privileg.";

/** The randomly picked values that make up one line. */
export interface LineParts {
  slotA: string;
  slotB: string;
  subject: string;
  title: string;
}

const PRIME = 2_147_483_647n;

// Stable pseudo-random number, so a line never changes on reload. Squaring
// a few times scrambles keys that differ in only one digit.
const hash = (text: string): number => {
  let value = 7n;

  for (const char of text) {
    value = (value * 31n + BigInt(char.codePointAt(0) ?? 0)) % PRIME;
  }

  for (let round = 0; round < 3; round += 1) {
    value = (value * value + 12_345n) % PRIME;
  }

  return Number(value);
};

const pickIndex = (length: number, seed: string, key: string): number =>
  hash(`${seed}:${key}`) % length;

const pick = (list: readonly string[], seed: string, key: string): string =>
  list[pickIndex(list.length, seed, key)] ?? "";

const subjectFor = (seed: string, index: number) =>
  SUBJECTS[pickIndex(SUBJECTS.length, seed, `${index}:subject`)] ?? SUBJECTS[0];

/**
 * Every part is picked at random per line, but always the same way for the
 * same session and line.
 * @param seed - The session id.
 * @param index - Number of lines completed so far.
 * @returns The picked values for that line.
 */
export const partsForLine = (seed: string, index: number): LineParts => ({
  slotA: pick(SLOT_A, seed, `${index}:a`),
  slotB: pick(SLOT_B, seed, `${index}:b`),
  subject: subjectFor(seed, index).subject,
  title: pick(TITLES, seed, `${index}:title`),
});

/**
 * Builds the exact sentence that has to be typed.
 * @param seed - The session id.
 * @param index - Number of lines completed so far.
 * @returns The full target sentence.
 */
export const lineFor = (seed: string, index: number): string => {
  const { slotA, slotB, title } = partsForLine(seed, index);
  const { has, pronoun, subject } = subjectFor(seed, index);

  return `${subject} ${has} kein Recht auf ${slotA}. Alles, was ${pronoun} ${has}, ist ein ${slotB} Privileg von ${title}.`;
};
