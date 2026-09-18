"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TeacherSidebar } from "./teacher-sidebar";
import { ScreenMessageList } from "./screen-message-list";
import { AnnouncementBanner } from "@/components/chat/announcement-banner";
import { MessageInput } from "@/components/chat/message-input";
import {
  getConversationMessages,
  markMessageRead,
  type ClassMessage,
} from "@/lib/messages/actions";
import { useChatWs } from "@/lib/realtime/use-chat-ws";
import { roomNameForClass } from "@/lib/realtime/contract";
import type { ScreenTeacher } from "@/lib/messages/queries";

export function ScreenChatLayout({
  userId,
  className,
  classId,
  conversationId,
  cfWorkerUrl,
  teachers,
}: {
  userId: string;
  className: string;
  classId: string;
  conversationId: string;
  cfWorkerUrl: string | null;
  teachers: ScreenTeacher[];
}) {
  const [selectedKey, setSelectedKey] = useState<string>("all");
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const reportedRef = useRef(new Set<string>());

  const wsUrl = cfWorkerUrl
    ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForClass(classId)}`
    : null;

  const { messages: wsMessages, connected, presence } = useChatWs(
    wsUrl,
    { userId, name: className, role: "classroom" },
    (update) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === update.messageId ? { ...m, status: update.status } : m,
        ),
      );
    },
  );

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function loadLatest() {
      const msgs = await getConversationMessages(conversationId);
      if (active) setMessages(msgs);
    }

    void loadLatest();

    if (!connected) {
      pollTimer = setInterval(() => {
        if (document.hidden) return;
        void loadLatest();
      }, 5000);
    }

    function onVisibilityChange() {
      if (!document.hidden && !connected) void loadLatest();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [conversationId, connected]);

  useEffect(() => {
    if (wsMessages.length === 0) return;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMsgs = wsMessages
        .filter((m) => !existingIds.has(m.messageId) && m.senderId !== userId)
        .map((m): ClassMessage => ({
          id: m.messageId,
          senderName: m.senderName,
          senderRole: m.senderRole,
          senderId: m.senderId,
          content: m.content,
          type: m.type,
          mimeType: m.mimeType,
          status: "delivered",
          deletedAt: null,
          editedAt: null,
          editHistory: null,
          mentions: null,
          createdAt: new Date(m.createdAt),
        }));
      if (newMsgs.length === 0) return prev;
      return [...prev, ...newMsgs];
    });
  }, [wsMessages, userId]);

  useEffect(() => {
    for (const msg of messages) {
      if (reportedRef.current.has(msg.id)) continue;
      if (msg.senderId === userId) continue;
      if (msg.senderRole !== "teacher") continue;
      reportedRef.current.add(msg.id);
      if (msg.status === "displayed") continue;
      setTimeout(() => {
        void markMessageRead(msg.id).catch(() => {});
      }, 5000);
    }
  }, [messages, userId]);

  const filteredMessages = useMemo(() => {
    if (selectedKey === "all") return messages;
    return messages.filter(
      (m) => m.senderId === selectedKey || m.senderId === userId,
    );
  }, [messages, selectedKey, userId]);

  const unreadByTeacher = useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of messages) {
      if (msg.senderId === userId) continue;
      if (msg.senderRole !== "teacher") continue;
      if (msg.status === "displayed") continue;
      map.set(msg.senderId, (map.get(msg.senderId) ?? 0) + 1);
    }
    return map;
  }, [messages, userId]);

  const totalUnread = useMemo(() => {
    let count = 0;
    for (const v of unreadByTeacher.values()) count += v;
    return count;
  }, [unreadByTeacher]);

  function handleOptimisticSend(
    tempId: string,
    content: string,
    type: "text" | "urgent",
  ): void {
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderName: className,
        senderRole: "classroom",
        senderId: userId,
        content,
        type,
        mimeType: null,
        status: "pending",
        deletedAt: null,
        editedAt: null,
        editHistory: null,
        mentions: null,
        createdAt: new Date(),
      },
    ]);
  }

  function handleSendConfirmed(
    tempId: string,
    ok: boolean,
    realId?: string,
  ): void {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== tempId) return m;
        if (!ok) return m;
        return { ...m, id: realId ?? tempId, status: "delivered" };
      }),
    );
  }

  const selectedTitle = useMemo(() => {
    if (selectedKey === "all") return "全部消息";
    const t = teachers.find((t) => t.teacherId === selectedKey);
    return t ? `${t.teacherName} · ${t.subjectName}` : "全部消息";
  }, [selectedKey, teachers]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-1">
      <div className="w-72 shrink-0 border-r border-border">
        <TeacherSidebar
          teachers={teachers}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          className={className}
          unreadByTeacher={unreadByTeacher}
          totalUnread={totalUnread}
        />
      </div>

      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-title-24 font-medium text-neutral-9">
              {selectedTitle}
            </h2>
            <p className="mt-0.5 text-copy-14 text-neutral-6">
              {className} · {presence.length} 人在线
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-neutral-5"}`}
            />
            <span className="text-copy-14 text-neutral-6">
              {connected ? "已连接" : "连接中"}
            </span>
          </div>
        </div>

        <AnnouncementBanner classId={classId} isTeacher={false} />

        <ScreenMessageList messages={filteredMessages} currentUserId={userId} />

        <div className="border-t border-border px-4 py-3">
          <MessageInput
            conversationId={conversationId}
            conversationType="group"
            allowUrgent
            onOptimisticSend={handleOptimisticSend}
            onSendConfirmed={handleSendConfirmed}
          />
        </div>
      </main>
    </div>
  );
}
