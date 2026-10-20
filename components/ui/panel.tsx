import type { ReactNode } from "react";

/**
 * A titled block of text, used for every non-game screen.
 * @param props - Title and content.
 * @returns The panel.
 */
export const Panel = ({
  children,
  title,
}: {
  children?: ReactNode;
  title?: string;
}) => (
  <section className="flex w-full max-w-2xl flex-col gap-4 leading-relaxed">
    {title === undefined ? null : (
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    )}
    {children}
  </section>
);
