"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  ContactSidebar,
  ChatHeader,
  ChatWindow,
  MessageInput,
  SearchPanel,
} from "./index";
import {
  getMyConversations,
  getConversationMessages,
  markConversationRead,
  type ConversationItem,
  type ClassMessage,
} from "@/lib/messages/actions";
import { useChatWs } from "@/lib/realtime/use-chat-ws";
import { roomNameForClass, roomNameForDirect } from "@/lib/realtime/contract";

export function ChatLayout({
  userName,
  userRole,
  allowUrgent,
  showStatus,
  cfWorkerUrl,
}: {
  userName: string;
  userRole: string;
  allowUrgent?: boolean;
  showStatus?: boolean;
  cfWorkerUrl: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void getMyConversations().then((cs) => {
      setConversations(cs);
      if (cs.length > 0) setSelectedId(cs[0]!.conversationId);
    });
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
    });
  }

  const wsUrl =
    selected && cfWorkerUrl
      ? selected.type === "group" && selected.classId
        ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForClass(selected.classId)}`
        : selected.type === "direct" && selected.participantAId && selected.participantBId
          ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForDirect(selected.participantAId, selected.participantBId)}`
          : null
      : null;

  const { messages: wsMessages, connected } = useChatWs(wsUrl);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function loadLatest() {
      const msgs = await getConversationMessages(selectedId!);
      if (active) {
        setMessages(msgs);
        if (msgs.length > 0) {
          setCurrentUserId(msgs[0]!.senderId);
        }
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
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMsgs = wsMessages
        .filter((m) => !existingIds.has(m.messageId))
        .map((m): ClassMessage => ({
          id: m.messageId,
          senderName: m.senderName,
          senderRole: m.senderRole,
          senderId: m.senderId,
          content: m.content,
          type: m.type,
          mimeType: m.mimeType,
          status: "displayed",
          deletedAt: null,
          editedAt: null,
          editHistory: null,
          createdAt: new Date(m.createdAt),
        }));
      if (newMsgs.length === 0) return prev;
      return [...prev, ...newMsgs];
    });
  }, [wsMessages]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-1">
      <ContactSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={handleSelectConversation}
        userName={userName}
        userRole={userRole}
      />

      <main className="flex flex-1 flex-col">
        {selected ? (
          <>
            <ChatHeader
              title={selected.title}
              subtitle={selected.subtitle}
              connected={connected}
              onSearchToggle={() => setSearching((v) => !v)}
              searching={searching}
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
            <ChatWindow
              messages={messages}
              currentUserId={currentUserId}
              showStatus={showStatus}
            />
            <div className="border-t border-border px-4 py-3">
              <MessageInput
                conversationId={selected.conversationId}
                allowUrgent={allowUrgent}
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
