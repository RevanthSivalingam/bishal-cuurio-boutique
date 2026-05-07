import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:border-transparent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
