"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-copy-14 font-medium outline-hidden transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent hover:-translate-y-px hover:bg-accent/90 active:translate-y-0",
        secondary: "bg-neutral-2 text-neutral-9 ring-1 ring-border hover:bg-neutral-3",
        ghost: "text-neutral-7 hover:bg-neutral-2 hover:text-neutral-10",
        danger: "bg-error text-on-error hover:-translate-y-px hover:bg-error/90 active:translate-y-0",
        warning: "bg-warning text-on-warning hover:-translate-y-px hover:bg-warning/90 active:translate-y-0",
        dark: "bg-neutral-2 text-neutral-9 ring-1 ring-border hover:bg-neutral-3",
      },
      size: {
        default: "min-h-10",
        sm: "min-h-9 rounded-md px-3 text-label-12",
        lg: "min-h-12 px-5 text-copy-15",
        touch: "min-h-14 rounded-lg px-6 text-copy-16",
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