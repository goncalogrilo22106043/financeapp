import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none transition placeholder:text-muted-foreground focus:border-foreground focus:ring-4 focus:ring-foreground/10",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
