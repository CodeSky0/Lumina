"use client";

import { type ButtonHTMLAttributes, forwardRef, useCallback, useState } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

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
  ({ variant = "primary", size = "md", className = "", disabled, onClick, children, ...props }, ref) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipples((prev) => [
          ...prev,
          { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
        ]);
        window.setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
        onClick?.(e);
      },
      [onClick],
    );

    return (
      <button
        ref={ref}
        disabled={disabled}
        onClick={handleClick}
        className={`relative overflow-hidden rounded-md font-medium transition-all duration-fast ease-standard outline-none active:scale-[0.97] disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
        {ripples.map((r) => (
          <span
            key={r.id}
            aria-hidden
            className="pointer-events-none absolute h-16 w-16 rounded-full bg-current/30 animate-ripple"
            style={{ left: r.x, top: r.y }}
          />
        ))}
      </button>
    );
  },
);

Button.displayName = "Button";
