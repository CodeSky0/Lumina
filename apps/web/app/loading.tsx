export default function Loading() {
  return <main className="flex min-h-[100dvh] items-center justify-center" role="status"><span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/25 border-t-accent" aria-hidden="true" /><span className="ml-3 text-copy-14 text-neutral-7">页面加载中</span></main>;
}
