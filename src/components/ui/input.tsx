import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full border border-border bg-bg px-4 text-sm text-text placeholder:text-text/40 transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
