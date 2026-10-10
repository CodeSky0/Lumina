import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-1 px-4">
      <div className="text-center">
        <h1 className="text-display-48 font-bold text-neutral-9">404</h1>
        <p className="mt-2 text-copy-14 text-neutral-6">
          页面不存在或已被移除
        </p>
      </div>
      <Link
        href="/login"
        className="rounded-lg bg-accent px-4 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90"
      >
        返回登录
      </Link>
    </div>
  );
}
