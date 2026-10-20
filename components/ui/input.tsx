import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Plain form input for the admin page.
 * @param props - Input props.
 * @returns An input element.
 */
export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input
    className={cn(
      "border-border bg-panel text-foreground focus:border-accent border px-3 py-2.5 text-base outline-none",
      className
    )}
    {...props}
  />
);
