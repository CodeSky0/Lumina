import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-md border border-border bg-neutral-1 px-3.5 py-2.5 text-copy-14 text-neutral-9 outline-hidden transition placeholder:text-neutral-6 hover:border-neutral-5 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-neutral-2 disabled:text-neutral-6",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";