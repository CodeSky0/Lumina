import type { Metadata } from "next";
import { AssignmentManager } from "@/components/admin/assignment-manager";
export const metadata: Metadata = { title: "教学任务分配" };
export default function AssignmentsPage() { return <AssignmentManager />; }
