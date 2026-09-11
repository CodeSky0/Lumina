"use client";

export function ChatHeader({
  title,
  subtitle,
  connected,
}: {
  title: string;
  subtitle?: string;
  connected?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">
          {title}
        </h2>
        {subtitle && (
          <span className="text-copy-13 text-neutral-7">{subtitle}</span>
        )}
      </div>
      {connected !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full transition-colors duration-slow ease-standard ${
              connected ? "bg-success" : "bg-error animate-pulse"
            }`}
          />
          <span className="text-label-12 text-neutral-6">
            {connected ? "已连接" : "连接中"}
          </span>
        </div>
      )}
    </div>
  );
}
