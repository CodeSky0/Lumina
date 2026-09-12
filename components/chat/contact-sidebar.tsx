"use client";

import { LayoutGroup, motion } from "motion/react";
import type { ConversationItem } from "@/lib/messages/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushSubscribe } from "@/components/push-subscribe";
import { NotificationBell } from "./notification-bell";
import { EASE } from "@/lib/motion";

const GROUP_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DIRECT_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export function ContactSidebar({
  conversations,
  selectedId,
  onSelect,
  userName,
  userRole,
}: {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userName: string;
  userRole: string;
}) {
  const roleLabel =
    userRole === "teacher" ? "教师" : userRole === "parent" ? "家长" : "大屏";

  const groupConvs = conversations.filter((c) => c.type === "group");
  const directConvs = conversations.filter((c) => c.type === "direct");

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-neutral-1 md:w-64">
      <div className="border-b border-border px-4 py-3">
        <h1 className="font-serif text-title-24 font-medium text-neutral-10">
          Lumina
        </h1>
        <p className="text-copy-13 text-neutral-7">
          {userName} · {roleLabel}
        </p>
      </div>

      <LayoutGroup>
        <div className="flex-1 overflow-y-auto">
          {groupConvs.length > 0 && (
            <div className="px-2 py-2">
              <p className="px-2 py-1 text-label-12 font-medium text-neutral-6">
                班级群
              </p>
              {groupConvs.map((c) => (
                <ContactItem
                  key={c.conversationId}
                  item={c}
                  icon={GROUP_ICON}
                  selected={selectedId === c.conversationId}
                  onClick={() => onSelect(c.conversationId)}
                />
              ))}
            </div>
          )}

          {directConvs.length > 0 && (
            <div className="px-2 py-2">
              <p className="px-2 py-1 text-label-12 font-medium text-neutral-6">
                私信
              </p>
              {directConvs.map((c) => (
                <ContactItem
                  key={c.conversationId}
                  item={c}
                  icon={DIRECT_ICON}
                  selected={selectedId === c.conversationId}
                  onClick={() => onSelect(c.conversationId)}
                />
              ))}
            </div>
          )}

          {conversations.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-8">
              <p className="text-copy-13 text-neutral-6">
                暂无会话
              </p>
            </div>
          )}
        </div>
      </LayoutGroup>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <div className="flex items-center gap-1">
          <NotificationBell />
          <PushSubscribe />
          <ThemeToggle />
        </div>
        <span className="text-caption-10 text-neutral-5">Lumina 流光</span>
      </div>
    </aside>
  );
}

function ContactItem({
  item,
  icon,
  selected,
  onClick,
}: {
  item: ConversationItem;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  const time = item.lastMessageAt
    ? item.lastMessageAt.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 4;
    e.currentTarget.style.setProperty("--mx", `${x.toFixed(1)}px`);
    e.currentTarget.style.setProperty("--my", `${y.toFixed(1)}px`);
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.setProperty("--mx", "0px");
    e.currentTarget.style.setProperty("--my", "0px");
  }

  return (
    <button
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
        selected
          ? "bg-accent/10 ring-1 ring-accent"
          : "hover:bg-neutral-2"
      }`}
    >
      {selected && (
        <>
          <motion.span
            layoutId="contact-active-glow"
            aria-hidden
            className="absolute left-0 top-1/2 h-9 w-2 -translate-y-1/2 rounded-full bg-accent opacity-60 blur-sm"
            transition={{ duration: 0.45, ease: EASE.spring }}
          />
          <motion.span
            layoutId="contact-active-bar"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-accent"
            transition={{ duration: 0.45, ease: EASE.spring }}
          />
        </>
      )}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-fast ease-out ${
          selected ? "bg-accent text-white" : "bg-neutral-2 text-neutral-7"
        }`}
        style={{ transform: "translate(var(--mx, 0px), var(--my, 0px))" }}
      >
        {icon}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span
            className={`truncate text-copy-14 ${
              selected ? "text-accent font-medium" : "text-neutral-9"
            }`}
          >
            {item.title}
          </span>
          {time && (
            <span className="shrink-0 text-caption-10 text-neutral-6">
              {time}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-copy-13 text-neutral-6">
            {item.lastMessagePreview ?? item.subtitle}
          </span>
          <div className="ml-1 flex shrink-0 items-center gap-1">
            {item.pinned && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-5">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1z" />
              </svg>
            )}
            {item.muted && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-5">
                <path d="M11 5 6 9H2v6h4l5 4z" />
                <path d="m22 9-6 6" />
                <path d="m16 9 6 6" />
              </svg>
            )}
            {item.unreadCount > 0 && (
              <span
                key={item.unreadCount}
                className={`animate-badge-bounce rounded-full px-1.5 py-0.5 text-caption-10 font-medium text-white ${item.muted ? "bg-neutral-5" : "bg-error"}`}
              >
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
