import type { Metadata } from "next";
import { ClassroomClient } from "@/components/classroom/classroom-client";

export const metadata: Metadata = { title: "教室消息中心" };
export default function ClassroomPage() { return <ClassroomClient />; }
