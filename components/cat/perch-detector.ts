export type PerchType = "ground" | "bubble" | "bar" | "rail";

export interface Perch {
  id: string;
  x1: number;
  x2: number;
  y: number;
  type: PerchType;
  priority: number;
}

const MIN_W = 28;
const MIN_GAP = 6;

function isVisible(rect: DOMRect, vh: number): boolean {
  return rect.bottom > 0 && rect.top < vh && rect.width >= MIN_W;
}

function hasClass(el: Element, sub: string): boolean {
  const c = el.className;
  return typeof c === "string" && c.includes(sub);
}

function dedupe(perches: Perch[]): Perch[] {
  const sorted = [...perches].sort((a, b) => a.y - b.y || a.x1 - b.x1);
  const out: Perch[] = [];
  for (const p of sorted) {
    const merge = out.find(
      (q) => Math.abs(q.y - p.y) < MIN_GAP && !(p.x2 < q.x1 + MIN_GAP || p.x1 > q.x2 - MIN_GAP),
    );
    if (merge) {
      merge.x1 = Math.min(merge.x1, p.x1);
      merge.x2 = Math.max(merge.x2, p.x2);
      merge.priority = Math.max(merge.priority, p.priority);
    } else {
      out.push({ ...p });
    }
  }
  return out;
}

export function detectPerches(root: HTMLElement): Perch[] {
  if (typeof window === "undefined") return [];
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const perches: Perch[] = [];

  perches.push({ id: "ground", x1: 0, x2: vw, y: vh, type: "ground", priority: 1 });

  const candidates = root.querySelectorAll<HTMLElement>(
    "[data-perch], aside, main [class*='rounded-xl'], [class*='rounded-lg'][class*='ring'], [class*='border-t'], [class*='border-b']",
  );

  let i = 0;
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (!isVisible(rect, vh)) continue;
    if (rect.width > vw) continue;

    const isExplicit = el.hasAttribute("data-perch");
    const isBubble = hasClass(el, "rounded-xl") && (hasClass(el, "ring") || isExplicit);
    const isRail = hasClass(el, "rounded-lg") && hasClass(el, "ring");
    const isBorderTop = hasClass(el, "border-t");
    const isBorderBottom = hasClass(el, "border-b");
    const isAside = el.tagName === "ASIDE";

    if (isBubble) {
      perches.push({ id: `b${i}`, x1: rect.left + 4, x2: rect.right - 4, y: rect.top, type: "bubble", priority: 3 });
    } else if (isRail && rect.width >= 40) {
      perches.push({ id: `r${i}`, x1: rect.left + 2, x2: rect.right - 2, y: rect.top, type: "rail", priority: 1 });
    } else if (isBorderTop && rect.width >= 60) {
      perches.push({ id: `t${i}`, x1: rect.left, x2: rect.right, y: rect.top, type: "bar", priority: 2 });
    } else if (isBorderBottom && rect.width >= 60) {
      perches.push({ id: `bt${i}`, x1: rect.left, x2: rect.right, y: rect.bottom, type: "bar", priority: 2 });
    } else if (isAside) {
      perches.push({ id: `a${i}`, x1: rect.right, x2: rect.right, y: rect.top, type: "bar", priority: 2 });
    } else if (isExplicit) {
      perches.push({ id: `e${i}`, x1: rect.left, x2: rect.right, y: rect.top, type: "bar", priority: 2 });
    }
    i++;
  }

  return dedupe(perches).slice(0, 40);
}

export class PerchDetector {
  private root: HTMLElement;
  private onUpdate: (perches: Perch[]) => void;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ro: ResizeObserver | null = null;
  private mo: MutationObserver | null = null;
  private running = false;

  constructor(root: HTMLElement, onUpdate: (perches: Perch[]) => void) {
    this.root = root;
    this.onUpdate = onUpdate;
  }

  private schedule = (): void => {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onUpdate(detectPerches(this.root));
    }, 200);
  };

  start(): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.onUpdate(detectPerches(this.root));

    this.ro = new ResizeObserver(() => this.schedule());
    this.ro.observe(this.root);
    this.ro.observe(document.body);

    this.mo = new MutationObserver(() => this.schedule());
    this.mo.observe(this.root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-perch"] });

    window.addEventListener("resize", this.schedule, { passive: true });
    window.addEventListener("scroll", this.schedule, { passive: true, capture: true });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ro?.disconnect();
    this.ro = null;
    this.mo?.disconnect();
    this.mo = null;
    window.removeEventListener("resize", this.schedule);
    window.removeEventListener("scroll", this.schedule, { capture: true } as EventListenerOptions);
  }

  refresh(): void {
    this.onUpdate(detectPerches(this.root));
  }
}
