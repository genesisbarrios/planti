import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest text-paper hover:bg-forest-hover disabled:hover:bg-forest",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken disabled:hover:bg-surface",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}
