import type { CatPose } from "./cat-sprites";
import type { Perch } from "./perch-detector";

export type Facing = "left" | "right";
export type Mode = "idle" | "walk" | "sit" | "lie" | "sleep" | "groom" | "yawn" | "stretch" | "play" | "jump" | "fall";

export interface PoseChange {
  pose: CatPose;
  facing: Facing;
}

export interface StepResult {
  x: number;
  y: number;
  poseChanged: boolean;
  pose: CatPose;
  facing: Facing;
}

const G = 0.55;
const WALK_SPEED = 1.15;
const JUMP_VY = -10.5;
const JUMP_VX = 2.6;
const EDGE_MARGIN = 6;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const POSE_OF: Record<Mode, CatPose> = {
  idle: "idle",
  walk: "walk",
  sit: "sit",
  lie: "lie",
  sleep: "sleep",
  groom: "groom",
  yawn: "yawn",
  stretch: "stretch",
  play: "play",
  jump: "jump",
  fall: "fall",
};

export class CatEngine {
  private x: number;
  private y: number;
  private vx = 0;
  private vy = 0;
  private facing: Facing;
  private mode: Mode = "idle";
  private perches: Perch[];
  private onPoseChange: (c: PoseChange) => void;

  private actionTimer = randInt(50, 150);
  private idleSince = 0;
  private sinceInteract = 0;
  private currentPerch: Perch | null = null;
  private prevY: number;
  private lastPose: CatPose = "idle";
  private lastFacing: Facing;

  constructor(opts: {
    perches: Perch[];
    initialX: number;
    initialY: number;
    initialFacing?: Facing;
    onPoseChange: (c: PoseChange) => void;
  }) {
    this.x = opts.initialX;
    this.y = opts.initialY;
    this.prevY = opts.initialY;
    this.facing = opts.initialFacing ?? "right";
    this.lastFacing = this.facing;
    this.perches = opts.perches;
    this.onPoseChange = opts.onPoseChange;
    this.currentPerch = this.findPerchBelow(opts.initialX, opts.initialY);
  }

  setPerches(perches: Perch[]): void {
    this.perches = perches;
    if (!this.currentPerch || !perches.includes(this.currentPerch)) {
      this.currentPerch = this.findPerchBelow(this.x, this.y);
    }
  }

  private findPerchBelow(x: number, y: number): Perch | null {
    let best: Perch | null = null;
    let bestDy = Infinity;
    for (const p of this.perches) {
      if (p.x2 - p.x1 < 1) continue;
      if (x < p.x1 - 4 || x > p.x2 + 4) continue;
      const dy = p.y - y;
      if (dy >= -2 && dy < bestDy) {
        bestDy = dy;
        best = p;
      }
    }
    return best;
  }

  private findNearbyPerch(): Perch | null {
    const candidates = this.perches.filter((p) => {
      if (p.x2 - p.x1 < 20) return false;
      if (p === this.currentPerch) return false;
      const cx = (p.x1 + p.x2) / 2;
      const dx = Math.abs(cx - this.x);
      const dy = Math.abs(p.y - this.y);
      return dx < 260 && dy < 140;
    });
    if (candidates.length === 0) return null;
    return candidates[randInt(0, candidates.length - 1)]!;
  }

  private setMode(m: Mode, duration: number): void {
    this.mode = m;
    this.actionTimer = duration;
  }

  private decide(): void {
    const r = Math.random();
    if (r < 0.16) {
      this.mode = "walk";
      this.facing = Math.random() < 0.5 ? "left" : "right";
      this.setMode("walk", randInt(90, 240));
    } else if (r < 0.46) {
      this.setMode("sit", randInt(180, 420));
    } else if (r < 0.64) {
      this.setMode("lie", randInt(240, 540));
    } else if (r < 0.74) {
      this.setMode("groom", randInt(120, 280));
    } else if (r < 0.82) {
      this.setMode("yawn", randInt(80, 160));
    } else if (r < 0.89) {
      this.setMode("stretch", randInt(100, 200));
    } else if (r < 0.96) {
      this.startJump();
    } else {
      this.setMode("idle", randInt(50, 150));
    }
  }

  private startJump(): void {
    const target = this.findNearbyPerch();
    const tx = target ? (target.x1 + target.x2) / 2 : this.x + (this.facing === "right" ? 60 : -60);
    const dir = tx >= this.x ? 1 : -1;
    this.facing = dir === 1 ? "right" : "left";
    this.vx = dir * JUMP_VX;
    this.vy = JUMP_VY;
    this.mode = "jump";
    this.actionTimer = 120;
    this.currentPerch = null;
  }

  poke(px: number, py: number, onCat: boolean): void {
    this.sinceInteract = 0;
    if (this.mode === "sleep") {
      this.setMode("idle", randInt(40, 90));
      return;
    }
    if (onCat) {
      this.setMode("play", randInt(120, 200));
      return;
    }
    const dir = px >= this.x ? 1 : -1;
    this.facing = dir === 1 ? "right" : "left";
    if (Math.abs(px - this.x) < 40 && Math.abs(py - this.y) < 60) {
      this.setMode("play", randInt(100, 180));
    } else {
      this.vx = dir * JUMP_VX * 0.8;
      this.vy = JUMP_VY * 0.75;
      this.mode = "jump";
      this.actionTimer = 90;
      this.currentPerch = null;
    }
  }

  step(): StepResult {
    this.sinceInteract++;

    switch (this.mode) {
      case "idle": {
        this.idleSince++;
        this.actionTimer--;
        if (this.idleSince > 7200) {
          this.setMode("sleep", 99999);
        } else if (this.actionTimer <= 0) {
          this.decide();
        }
        break;
      }
      case "walk": {
        const dir = this.facing === "right" ? 1 : -1;
        this.x += WALK_SPEED * dir;
        const perch = this.currentPerch;
        if (perch) {
          if (this.x < perch.x1 + EDGE_MARGIN || this.x > perch.x2 - EDGE_MARGIN) {
            if (Math.random() < 0.5) {
              this.facing = this.facing === "right" ? "left" : "right";
            } else {
              this.x = clamp(this.x, perch.x1 + EDGE_MARGIN, perch.x2 - EDGE_MARGIN);
              this.setMode("idle", randInt(40, 120));
            }
          }
        } else {
          this.mode = "fall";
          this.vy = 0;
        }
        this.actionTimer--;
        if (this.actionTimer <= 0) this.setMode("idle", randInt(40, 100));
        break;
      }
      case "sit":
      case "lie":
      case "groom":
      case "yawn":
      case "stretch": {
        this.actionTimer--;
        if (this.actionTimer <= 0) {
          this.idleSince = 0;
          this.setMode("idle", randInt(50, 150));
        }
        break;
      }
      case "sleep": {
        break;
      }
      case "play": {
        this.actionTimer--;
        if (this.actionTimer <= 0) {
          this.idleSince = 0;
          this.setMode("idle", randInt(50, 130));
        }
        break;
      }
      case "jump":
      case "fall": {
        this.prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += G;
        if (this.mode === "jump" && this.vy > 0) this.mode = "fall";

        const landed = this.detectLanding();
        if (landed) {
          this.y = landed.y;
          this.vy = 0;
          this.vx = 0;
          this.currentPerch = landed;
          this.idleSince = 0;
          this.setMode("idle", randInt(30, 90));
        } else if (this.y > window.innerHeight + 200) {
          this.y = window.innerHeight - 4;
          this.x = clamp(this.x, 20, window.innerWidth - 20);
          this.currentPerch = this.findPerchBelow(this.x, this.y);
          this.setMode("idle", randInt(30, 80));
        }
        this.actionTimer--;
        if (this.actionTimer <= 0) {
          this.mode = "fall";
          this.actionTimer = 200;
        }
        break;
      }
    }

    const pose = POSE_OF[this.mode];
    const changed = pose !== this.lastPose || this.facing !== this.lastFacing;
    if (changed) {
      this.lastPose = pose;
      this.lastFacing = this.facing;
      this.onPoseChange({ pose, facing: this.facing });
    }

    return { x: this.x, y: this.y, poseChanged: changed, pose, facing: this.facing };
  }

  private detectLanding(): Perch | null {
    if (this.vy < 0) return null;
    for (const p of this.perches) {
      if (p.x2 - p.x1 < 1) continue;
      if (this.x < p.x1 - 6 || this.x > p.x2 + 6) continue;
      if (this.prevY <= p.y && this.y >= p.y) {
        return p;
      }
    }
    return null;
  }

  getPose(): CatPose {
    return POSE_OF[this.mode];
  }

  isSleeping(): boolean {
    return this.mode === "sleep";
  }
}
