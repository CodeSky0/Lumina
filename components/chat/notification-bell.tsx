"use client";

import { useState, useTransition, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications/actions";

export function NotificationBell({
  onSelectConversation,
}: {
  onSelectConversation?: (conversationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
    });
  }, []);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      startTransition(async () => {
        const items = await getMyNotifications();
        setNotifications(items);
      });
    }
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date() })),
      );
    });
  }

  function handleClickNotification(n: NotificationItem) {
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === n.id ? { ...item, readAt: new Date() } : item,
          ),
        );
      });
    }
    if (n.conversationId && onSelectConversation) {
      onSelectConversation(n.conversationId);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-neutral-7 transition-colors hover:bg-neutral-2 hover:text-neutral-9"
        aria-label="通知"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-caption-10 font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-10 z-50 w-80 rounded-lg bg-neutral-1 shadow-lg ring-1 ring-border"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-label-12 font-medium text-neutral-9">
                  通知
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-caption-10 text-accent hover:opacity-80"
                  >
                    全部已读
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {pending && notifications.length === 0 && (
                  <p className="py-4 text-center text-copy-13 text-neutral-6">
                    加载中…
                  </p>
                )}
                {!pending && notifications.length === 0 && (
                  <p className="py-4 text-center text-copy-13 text-neutral-6">
                    暂无通知
                  </p>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`block w-full border-b border-border px-3 py-2 text-left last:border-0 transition-colors hover:bg-neutral-2 ${
                      !n.readAt ? "bg-accent/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-copy-13 font-medium text-neutral-9">
                        {n.title}
                      </span>
                      <span className="text-caption-10 text-neutral-5">
                        {n.createdAt.toLocaleString("zh-CN", {
                          hour12: false,
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 truncate text-copy-13 text-neutral-6">
                        {n.body}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
