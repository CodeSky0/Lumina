import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import TeacherPanel from "./teacher-panel";

export default async function TeacherPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "teacher") redirect("/login");

  const cfWorkerUrl = process.env.CF_WORKER_URL ?? null;
  return (
    <TeacherPanel
      teacherId={session.user.id}
      teacherName={session.user.name}
      cfWorkerUrl={cfWorkerUrl}
    />
  );
}
