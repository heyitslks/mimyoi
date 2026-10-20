import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const variants = {
  link: "p-0 text-sm text-muted underline underline-offset-4 hover:text-foreground disabled:invisible",
  primary:
    "border border-accent bg-accent px-6 py-3 font-semibold text-accent-foreground disabled:opacity-40",
} as const;

/**
 * The only button. Pages may place it, not restyle it.
 * @param props - Button props plus a variant.
 * @returns A button element.
 */
export const Button = ({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) => (
  <button
    className={cn(
      "cursor-pointer disabled:cursor-default",
      variants[variant],
      className
    )}
    // oxlint-disable-next-line react/button-has-type -- default is set above
    type={type}
    {...props}
  />
);
