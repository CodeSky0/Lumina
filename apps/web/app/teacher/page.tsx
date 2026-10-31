import type { Metadata } from "next";
import { TeacherClient } from "@/components/teacher/teacher-client";

export const metadata: Metadata = { title: "教师工作区" };
export default function TeacherPage() { return <TeacherClient />; }
