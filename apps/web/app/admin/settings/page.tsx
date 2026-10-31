import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/settings-form";
export const metadata: Metadata = { title: "系统设置" };
export default function SettingsPage() { return <SettingsForm />; }
