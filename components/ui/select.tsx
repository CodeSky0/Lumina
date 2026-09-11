"use client";

import { type SelectHTMLAttributes, forwardRef } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  placeholder?: string;
  options: Option[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, placeholder, options, className = "", id, ...props }, ref) => (
    <label htmlFor={id} className="space-y-1.5">
      {label && (
        <span className="block text-label-12 font-medium text-neutral-9">
          {label}
        </span>
      )}
      <select
        ref={ref}
        id={id}
        className={`rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  ),
);

Select.displayName = "Select";
