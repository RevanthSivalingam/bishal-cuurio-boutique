import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base",
        "placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
