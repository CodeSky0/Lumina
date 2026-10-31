import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/dashboard";
export const metadata: Metadata = { title: "工作概览" };
export default function AdminPage() { return <Dashboard />; }
