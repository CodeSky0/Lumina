import type { Metadata } from "next";
import { ResourcePage } from "@/components/admin/resource-page";
export const metadata: Metadata = { title: "科目管理" };
export default function SubjectsPage() { return <ResourcePage kind="subjects" />; }
