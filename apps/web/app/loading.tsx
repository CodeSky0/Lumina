export default function Loading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center animate-fadeIn" role="status">
      <span className="relative flex h-12 w-12 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-accent/15 animate-breathe" />
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
      </span>
      <span className="ml-3 text-copy-14 text-neutral-7">页面加载中</span>
    </main>
  );
}