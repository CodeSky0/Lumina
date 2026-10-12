"use client";

import { ScreenChatLayout } from "@/components/screen/screen-chat-layout";
import { CatOverlay } from "@/components/cat/cat-overlay";
import type { ScreenTeacher } from "@/lib/messages/queries";
import type { ScheduleEntry } from "@/lib/schedule/queries";

export default function ScreenDisplay({
  userId,
  className,
  classId,
  conversationId,
  cfWorkerUrl,
  teachers,
  scheduleCurrent,
  scheduleNext,
}: {
  userId: string;
  className: string;
  classId: string;
  conversationId: string;
  cfWorkerUrl: string | null;
  teachers: ScreenTeacher[];
  scheduleCurrent: ScheduleEntry | null;
  scheduleNext: ScheduleEntry | null;
}) {
  if (!classId || !conversationId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-copy-16 text-neutral-6">未绑定班级，请联系管理员</p>
      </div>
    );
  }

  return (
    <>
      <ScreenChatLayout
        userId={userId}
        className={className}
        classId={classId}
        conversationId={conversationId}
        cfWorkerUrl={cfWorkerUrl}
        teachers={teachers}
        scheduleCurrent={scheduleCurrent}
        scheduleNext={scheduleNext}
      />
      <CatOverlay />
    </>
  );
}
