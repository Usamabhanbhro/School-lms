import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm font-medium transition-colors duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none";

const variants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-white hover:bg-primary/90",
  secondary: "border-border bg-bg text-text hover:bg-surface",
  ghost: "border-transparent bg-transparent text-text hover:bg-surface",
  danger: "border-danger bg-danger text-white hover:bg-danger/90",
};

/** Shared by <Button> and by <Link> elements that need button styling. */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cn(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}
