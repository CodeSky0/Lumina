"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  ContactSidebar,
  ChatHeader,
  ChatWindow,
  MessageInput,
  SearchPanel,
  AnnouncementBanner,
} from "./index";
import {
  getMyConversations,
  getConversationMessages,
  markConversationRead,
  markMessageRead,
  type ConversationItem,
  type ClassMessage,
} from "@/lib/messages/actions";
import type { MessageType } from "@/lib/db/schema";
import { useChatWs } from "@/lib/realtime/use-chat-ws";
import { roomNameForClass, roomNameForDirect } from "@/lib/realtime/contract";

export function ChatLayout({
  userId,
  userName,
  userRole,
  allowUrgent,
  showStatus,
  cfWorkerUrl,
}: {
  userId: string;
  userName: string;
  userRole: string;
  allowUrgent?: boolean;
  showStatus?: boolean;
  cfWorkerUrl: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const reportedRef = useRef(new Set<string>());

  useEffect(() => {
    void getMyConversations().then((cs) => {
      setConversations(cs);
      if (cs.length > 0) setSelectedId(cs[0]!.conversationId);
    }).catch(() => {});
  }, []);

  const selected = conversations.find((c) => c.conversationId === selectedId);

  function handleSelectConversation(id: string) {
    setSelectedId(id);
    void markConversationRead(id).then(() => {
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === id ? { ...c, unreadCount: 0 } : c,
        ),
      );
    }).catch(() => {});
  }

  const wsUrl =
    selected && cfWorkerUrl
      ? selected.type === "group" && selected.classId
        ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForClass(selected.classId)}`
        : selected.type === "direct" && selected.participantAId && selected.participantBId
          ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForDirect(selected.participantAId, selected.participantBId)}`
          : null
      : null;

  const { messages: wsMessages, connected, presence } = useChatWs(
    wsUrl,
    { userId, name: userName, role: userRole as "parent" | "teacher" | "classroom" | "admin" },
    (update) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === update.messageId ? { ...m, status: update.status } : m,
        ),
      );
    },
  );

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function loadLatest() {
      const msgs = await getConversationMessages(selectedId!);
      if (active) {
        setMessages(msgs);
      }
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
  }, [selectedId, connected]);

  useEffect(() => {
    if (wsMessages.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync WS messages into local state
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
    reportedRef.current.clear();
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const convType = selected.type;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const msg of messages) {
      if (reportedRef.current.has(msg.id)) continue;
      if (msg.senderId === userId) continue;
      const shouldReport =
        convType === "direct" ||
        (convType === "group" && userRole === "classroom" && msg.senderRole === "teacher");
      if (!shouldReport) continue;
      reportedRef.current.add(msg.id);
      if (msg.status === "displayed") continue;
      timers.push(
        setTimeout(() => {
          void markMessageRead(msg.id).catch(() => {});
        }, 5000),
      );
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [messages, selected, userId, userRole]);

  function handleOptimisticSend(tempId: string, content: string, type: MessageType): void {
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderName: userName,
        senderRole: userRole as ClassMessage["senderRole"],
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

  function handleSendConfirmed(tempId: string, ok: boolean, realId?: string, content?: string): void {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== tempId) return m;
        if (!ok) return { ...m, status: "pending" as const };
        return { ...m, id: realId ?? tempId, status: "delivered" as const, content: content ?? m.content };
      }),
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-1">
      <div className={`${selectedId ? "hidden md:block" : "block"} w-full md:w-auto`}>
        <ContactSidebar
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          userName={userName}
          userRole={userRole}
        />
      </div>

      <main className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col`}>
        {selected ? (
          <>
            <ChatHeader
              title={selected.title}
              subtitle={selected.subtitle}
              connected={connected}
              presence={presence}
              currentUserId={userId}
              onSearchToggle={() => setSearching((v) => !v)}
              searching={searching}
              onBack={() => setSelectedId(null)}
            />
            <AnimatePresence>
              {searching && (
                <SearchPanel
                  onClose={() => setSearching(false)}
                  onSelect={(id) => {
                    handleSelectConversation(id);
                    setSearching(false);
                  }}
                />
              )}
            </AnimatePresence>
            {selected.type === "group" && selected.classId && (
              <AnnouncementBanner
                classId={selected.classId}
                isTeacher={userRole === "teacher"}
              />
            )}
            <ChatWindow
              messages={messages}
              currentUserId={userId}
              showStatus={showStatus}
            />
            <div className="border-t border-border px-4 py-3">
              <MessageInput
                conversationId={selected.conversationId}
                conversationType={selected.type}
                allowUrgent={allowUrgent}
                onOptimisticSend={handleOptimisticSend}
                onSendConfirmed={handleSendConfirmed}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-copy-14 text-neutral-6">请选择左侧会话开始聊天</p>
          </div>
        )}
      </main>
    </div>
  );
}
