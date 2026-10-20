import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves conflicting Tailwind utilities.
 * @param inputs - Class names, possibly conditional.
 * @returns One class string.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
