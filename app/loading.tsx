export default function Loading() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-1">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl animate-breathe" />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-neutral-4 border-t-accent" />
          <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse-ring" />
        </div>
        <div className="relative h-1 w-32 overflow-hidden rounded-full bg-neutral-3">
          <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent animate-shimmer" />
        </div>
        <p className="text-copy-14 text-neutral-6">加载中…</p>
      </div>
    </div>
  );
}
