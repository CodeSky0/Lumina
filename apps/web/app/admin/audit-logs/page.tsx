import type { Metadata } from "next";
import { AuditLogList } from "@/components/admin/audit-log-list";
export const metadata: Metadata = { title: "审计日志" };
export default function AuditLogsPage() { return <AuditLogList />; }
