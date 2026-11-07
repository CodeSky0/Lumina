import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full resize-y rounded-md border border-border bg-neutral-1 px-3.5 py-3 text-copy-14 leading-6 text-neutral-9 outline-hidden transition placeholder:text-neutral-6 hover:border-neutral-5 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-neutral-2 disabled:text-neutral-6",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";