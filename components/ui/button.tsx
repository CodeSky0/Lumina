"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:opacity-90 focus:ring-2 focus:ring-accent",
  secondary:
    "bg-neutral-3 text-neutral-9 hover:bg-neutral-4 focus:ring-2 focus:ring-neutral-5",
  ghost:
    "bg-transparent text-neutral-9 hover:bg-neutral-3 focus:ring-2 focus:ring-neutral-5",
  danger:
    "bg-transparent text-error hover:bg-neutral-3 focus:ring-2 focus:ring-error",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-label-12",
  md: "px-4 py-2 text-copy-14",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled}
      className={`rounded-md font-medium transition-all duration-fast ease-standard outline-none active:scale-[0.97] disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = "Button";
