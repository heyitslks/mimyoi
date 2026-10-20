import type { ReactNode } from "react";

/**
 * A row of counters.
 * @param props - The Stat elements.
 * @returns The grid.
 */
export const StatGrid = ({ children }: { children: ReactNode }) => (
  <div className="border-border bg-border grid grid-cols-2 gap-px border sm:grid-cols-4">
    {children}
  </div>
);

/**
 * One counter with a label.
 * @param props - Label and value.
 * @returns The counter.
 */
export const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-background flex flex-col gap-1 px-4 py-3.5">
    <span className="font-mono text-2xl tabular-nums">{value}</span>
    <span className="text-muted text-xs tracking-wider uppercase">{label}</span>
  </div>
);
