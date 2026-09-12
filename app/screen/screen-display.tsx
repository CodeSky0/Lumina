"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function ScreenDisplay({
  userId,
  className,
}: {
  userId: string;
  className: string;
}) {
  return (
    <ChatLayout
      userId={userId}
      userName={className}
      userRole="classroom"
      allowUrgent
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
