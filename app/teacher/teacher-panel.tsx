"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function TeacherPanel({ teacherName }: { teacherName: string }) {
  return (
    <ChatLayout
      userName={teacherName}
      userRole="teacher"
      allowUrgent
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
