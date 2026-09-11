import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function Card({ title, action, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`space-y-4 rounded-xl bg-neutral-2 p-6 ring-1 ring-border ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && (
            <h2 className="font-serif text-title-20 font-medium text-neutral-9">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
