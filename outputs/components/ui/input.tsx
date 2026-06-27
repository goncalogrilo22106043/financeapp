import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-background px-4 text-base outline-none transition placeholder:text-muted-foreground focus:border-foreground focus:ring-4 focus:ring-foreground/10",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
