"use client";

import type { PresenceUser } from "@/lib/realtime/contract";

export function ChatHeader({
  title,
  subtitle,
  connected,
  presence,
  currentUserId,
  onSearchToggle,
  searching,
  onBack,
}: {
  title: string;
  subtitle?: string;
  connected?: boolean;
  presence?: PresenceUser[];
  currentUserId?: string;
  onSearchToggle?: () => void;
  searching?: boolean;
  onBack?: () => void;
}) {
  const onlineOthers = presence?.filter((u) => u.userId !== currentUserId) ?? [];
  const onlineCount = onlineOthers.length;

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-7 hover:bg-neutral-2 md:hidden"
            aria-label="返回"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </button>
        )}
        <div className="flex flex-col">
          <h2 className="font-serif text-title-20 font-medium text-neutral-10">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {subtitle && (
              <span className="text-copy-13 text-neutral-7">{subtitle}</span>
            )}
            {connected && onlineCount > 0 && (
              <span className="flex items-center gap-1 text-label-12 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {onlineCount} 人在线
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onSearchToggle && (
          <button
            onClick={onSearchToggle}
            className={`rounded-md p-1.5 transition-colors ${
              searching
                ? "bg-accent/10 text-accent"
                : "text-neutral-6 hover:bg-neutral-2 hover:text-neutral-9"
            }`}
            aria-label="搜索消息"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        )}
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
    </div>
  );
}
