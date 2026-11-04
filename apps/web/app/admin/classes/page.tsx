import type { Metadata } from "next";
import { ResourcePage } from "@/components/admin/resource-page";
export const metadata: Metadata = { title: "班级管理" };
export default function ClassesPage() { return <ResourcePage kind="classes" />; }
