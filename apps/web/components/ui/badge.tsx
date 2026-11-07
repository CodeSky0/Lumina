import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-border bg-neutral-2 text-neutral-7",
  indigo: "border-accent/25 bg-accent/8 text-accent",
  green: "border-success/25 bg-success/10 text-success",
  yellow: "border-warning/30 bg-warning/10 text-warning",
  red: "border-error/30 bg-error/8 text-error",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof tones;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-label-12 font-medium", tones[tone], className)} {...props} />;
}