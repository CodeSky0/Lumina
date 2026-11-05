"use client";

import { UrgentDialog } from "@/components/classroom/urgent-dialog";
import { TeacherUrgentDialog } from "@/components/urgent/teacher-urgent-dialog";
import { useSessionStore } from "@/stores/session";

export function GlobalUrgentHost() {
  const role = useSessionStore((state) => state.user?.role);
  if (role === "classroom") return <UrgentDialog />;
  if (role === "teacher") return <TeacherUrgentDialog />;
  return null;
}
