import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "sm" | "xs";

const base =
  "inline-flex items-center justify-center gap-2 border font-medium transition-colors duration-150 ease-out hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none";

const sizes: Record<ButtonSize, string> = {
  default: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs gap-1.5",
  xs: "h-7 px-2.5 text-xs gap-1",
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-white hover:bg-primary/90",
  secondary: "border-border bg-bg text-text hover:bg-surface",
  ghost: "border-transparent bg-transparent text-text hover:bg-surface",
  danger: "border-danger bg-danger text-white hover:bg-danger/90",
};

/** Shared by <Button> and by <Link> elements that need button styling. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  sizeOrClassName?: ButtonSize | string,
  className?: string,
): string {
  let size: ButtonSize = "default";
  let extraClass = className;
  if (sizeOrClassName === "default" || sizeOrClassName === "sm" || sizeOrClassName === "xs") {
    size = sizeOrClassName;
  } else if (typeof sizeOrClassName === "string") {
    extraClass = cn(sizeOrClassName, className);
  }
  return cn(base, sizes[size], variants[variant], extraClass);
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
