"use client";

import { ChatLayout } from "@/components/chat/chat-layout";

export default function TeacherPanel({ teacherId, teacherName, cfWorkerUrl }: { teacherId: string; teacherName: string; cfWorkerUrl: string | null }) {
  return (
    <ChatLayout
      userId={teacherId}
      userName={teacherName}
      userRole="teacher"
      allowUrgent
      cfWorkerUrl={cfWorkerUrl}
    />
  );
}
