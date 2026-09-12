"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function TeacherPanel({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  return (
    <ChatLayout
      userId={teacherId}
      userName={teacherName}
      userRole="teacher"
      allowUrgent
      cfWorkerUrl={process.env.NEXT_PUBLIC_CF_WORKER_URL ?? null}
    />
  );
}
