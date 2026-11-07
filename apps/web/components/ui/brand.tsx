export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="group flex items-center gap-3">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-accent text-on-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6" aria-hidden="true">
        <span className="font-serif text-title-20 leading-none text-on-accent">L</span>
        <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-paper ring-1 ring-accent/30 transition-transform duration-500 group-hover:scale-125" />
      </span>
      {!compact && (
        <span className="text-title-20 font-medium leading-none tracking-tight text-neutral-10">
          Lumina
          <span className="y-meta ml-2 text-label-12 font-normal text-neutral-6">校园通讯</span>
        </span>
      )}
    </div>
  );
}
