import type { Metadata } from "next";
import { ResourcePage } from "@/components/admin/resource-page";
export const metadata: Metadata = { title: "通道管理" };
export default function ChannelsPage() { return <ResourcePage kind="channels" />; }
