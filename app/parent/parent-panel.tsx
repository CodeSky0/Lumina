"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function ParentPanel({ parentId, parentName, cfWorkerUrl }: { parentId: string; parentName: string; cfWorkerUrl: string | null }) {
  return (
    <ChatLayout
      userId={parentId}
      userName={parentName}
      userRole="parent"
      showStatus
      cfWorkerUrl={cfWorkerUrl}
    />
  );
}
