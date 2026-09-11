"use client";

import { useEffect, useState } from "react";
import {
  ContactSidebar,
  ChatHeader,
  ChatWindow,
  MessageInput,
} from "./index";
import {
  getMyConversations,
  getConversationMessages,
  type ConversationItem,
  type ClassMessage,
} from "@/lib/messages/actions";
import { useChatWs } from "@/lib/realtime/use-chat-ws";
import { roomNameForClass } from "@/lib/realtime/contract";

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

  useEffect(() => {
    void getMyConversations().then((cs) => {
      setConversations(cs);
      if (cs.length > 0) setSelectedId(cs[0]!.conversationId);
    });
  }, []);

  const selected = conversations.find((c) => c.conversationId === selectedId);

  const wsUrl =
    selected && cfWorkerUrl
      ? selected.type === "group" && selected.classId
        ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${roomNameForClass(selected.classId)}`
        : `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/dm-placeholder`
      : null;

  const { connected } = useChatWs(wsUrl);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void getConversationMessages(selectedId).then((msgs) => {
      if (active) {
        setMessages(msgs);
        if (msgs.length > 0) {
          setCurrentUserId(msgs[0]!.senderId);
        }
      }
    });
    const t = setInterval(() => {
      void getConversationMessages(selectedId).then((msgs) => {
        if (active) setMessages(msgs);
      });
    }, 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [selectedId]);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-1">
      <ContactSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
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
            />
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
