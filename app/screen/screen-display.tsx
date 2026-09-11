"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function ScreenDisplay({
  className,
}: {
  className: string;
}) {
  return (
    <ChatLayout
      userName={className}
      userRole="classroom"
      allowUrgent
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
