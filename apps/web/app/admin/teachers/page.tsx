import type { Metadata } from "next";
import { ResourcePage } from "@/components/admin/resource-page";
export const metadata: Metadata = { title: "教师管理" };
export default function TeachersPage() { return <ResourcePage kind="teachers" />; }
