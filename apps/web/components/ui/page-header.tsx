import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6">{eyebrow}</p>}
        <h1 className="text-title-24 font-medium tracking-tight text-neutral-10 sm:text-title-28">{title}</h1>
        <p className="mt-2 max-w-2xl text-copy-14 leading-6 text-neutral-7">{description}</p>
      </div>
      {action}
    </header>
  );
}