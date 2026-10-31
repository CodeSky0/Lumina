export default function Loading() {
  return <main className="flex min-h-[100dvh] items-center justify-center" role="status"><span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" aria-hidden="true" /><span className="ml-3 text-sm text-zinc-500">页面加载中</span></main>;
}
