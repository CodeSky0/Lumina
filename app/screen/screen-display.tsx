"use client";

import { ChatLayout } from "@/components/chat/chat-layout";
import { CatOverlay } from "@/components/cat/cat-overlay";

export default function ScreenDisplay({
  userId,
  className,
  cfWorkerUrl,
}: {
  userId: string;
  className: string;
  cfWorkerUrl: string | null;
}) {
  return (
    <>
      <ChatLayout
        userId={userId}
        userName={className}
        userRole="classroom"
        allowUrgent
        cfWorkerUrl={cfWorkerUrl}
      />
      <CatOverlay />
    </>
  );
}
