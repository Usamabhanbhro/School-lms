import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full border border-border bg-bg px-4 text-sm text-text placeholder:text-text/40 transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary focus-visible:outline-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
