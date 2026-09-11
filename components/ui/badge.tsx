import { type HTMLAttributes } from "react";

type Tone = "neutral" | "accent" | "success" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral-3 text-neutral-7",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
  error: "bg-error/15 text-error",
};

export function Badge({ tone = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-label-12 font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
