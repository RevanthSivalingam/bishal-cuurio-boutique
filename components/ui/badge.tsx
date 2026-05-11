import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
        success: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200",
        danger: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
        info: "bg-blue-100 text-blue-700",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
