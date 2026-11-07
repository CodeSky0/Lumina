import Link from "next/link";
import { EmptyState } from "@/components/ui/async-state";

export default function NotFound() {
  return <main id="main-content" className="page-enter flex min-h-[100dvh] items-center justify-center p-6"><EmptyState title="没有找到这个页面" description="地址可能已变更，请返回工作区继续操作。" action={<Link href="/" className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-copy-14 font-medium text-on-accent hover:bg-accent/90">返回工作区</Link>} /></main>;
}
