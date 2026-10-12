import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getScreenConversation, getScreenTeachers } from "@/lib/messages/queries";
import { getCurrentAndNextClass } from "@/lib/schedule/queries";
import ScreenDisplay from "./screen-display";

export default async function ScreenPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") redirect("/login");

  const cfWorkerUrl = process.env.CF_WORKER_URL ?? null;
  const screenConv = await getScreenConversation();

  if (!screenConv) {
    return (
      <ScreenDisplay
        userId={session.user.id}
        className="未绑定班级"
        classId=""
        conversationId=""
        cfWorkerUrl={cfWorkerUrl}
        teachers={[]}
        scheduleCurrent={null}
        scheduleNext={null}
      />
    );
  }

  const teachers = await getScreenTeachers(screenConv.classId);
  const schedule = await getCurrentAndNextClass(screenConv.classId);

  return (
    <ScreenDisplay
      userId={session.user.id}
      className={screenConv.className}
      classId={screenConv.classId}
      conversationId={screenConv.conversationId}
      cfWorkerUrl={cfWorkerUrl}
      teachers={teachers}
      scheduleCurrent={schedule.current}
      scheduleNext={schedule.next}
    />
  );
}
