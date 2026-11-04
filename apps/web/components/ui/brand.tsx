import { cn } from "@/lib/utils";

export function Brand({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500" aria-hidden="true">
        <span className="h-3.5 w-3.5 rounded-[4px] border-2 border-white" />
        <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      {!compact && <span className={cn("text-lg font-semibold tracking-tight", dark ? "text-white" : "text-zinc-950")}>Lumina<span className={cn("ml-2 text-xs font-normal", dark ? "text-zinc-400" : "text-zinc-400")}>校园通讯</span></span>}
    </div>
  );
}
