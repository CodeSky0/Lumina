"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => (
    <label htmlFor={id} className="space-y-1.5">
      {label && (
        <span className="block text-label-12 font-medium text-neutral-9">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent ${className}`}
        {...props}
      />
    </label>
  ),
);

Input.displayName = "Input";
