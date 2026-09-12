"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function ParentPanel({ parentId, parentName }: { parentId: string; parentName: string }) {
  return (
    <ChatLayout
      userId={parentId}
      userName={parentName}
      userRole="parent"
      showStatus
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
