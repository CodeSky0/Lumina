"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function ParentPanel({ parentName }: { parentName: string }) {
  return (
    <ChatLayout
      userName={parentName}
      userRole="parent"
      showStatus
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
