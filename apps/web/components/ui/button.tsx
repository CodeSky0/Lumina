"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-indigo-500 text-white hover:bg-indigo-600",
        secondary: "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50",
        ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
        danger: "bg-red-600 text-white hover:bg-red-700",
        warning: "bg-amber-500 text-zinc-950 hover:bg-amber-400",
        dark: "border border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/10",
      },
      size: {
        default: "min-h-10",
        sm: "min-h-9 rounded-lg px-3 text-xs",
        lg: "min-h-12 px-5 text-base",
        touch: "min-h-14 rounded-2xl px-6 text-lg",
        icon: "h-10 w-10 min-h-10 px-0",
        touchIcon: "h-12 w-12 min-h-12 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || isLoading} {...props}>
      {isLoading && <CircleNotch className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
