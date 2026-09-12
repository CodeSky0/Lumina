import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import TeacherPanel from "./teacher-panel";

export default async function TeacherPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "teacher") redirect("/login");

  return <TeacherPanel teacherId={session.user.id} teacherName={session.user.name} />;
}
