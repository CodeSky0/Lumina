import type { Metadata } from "next";
import { AnnouncementManager } from "@/components/admin/announcement-manager";
export const metadata: Metadata = { title: "公告发布" };
export default function AnnouncementsPage() { return <AnnouncementManager />; }
