import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full appearance-none rounded-md border border-border bg-neutral-1 px-3.5 py-2.5 text-copy-14 text-neutral-9 outline-hidden transition hover:border-neutral-5 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-neutral-2 disabled:text-neutral-6",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";