import type { ReactNode } from "react";

export type CatPose =
  | "idle"
  | "walk"
  | "sit"
  | "lie"
  | "sleep"
  | "stretch"
  | "groom"
  | "play"
  | "jump"
  | "fall"
  | "yawn";

export const CAT_DIM = { w: 100, h: 72 };

const F = "var(--cat-fur, #F4A261)";
const FD = "var(--cat-fur-dark, #D9792A)";
const FB = "var(--cat-belly, #FBF3E7)";
const N = "var(--cat-nose, #E8A0A0)";
const E = "var(--cat-eye, #5B8C3A)";
const O = "var(--cat-outline, #6B3A1A)";
const W = "var(--cat-white, #FFFFFF)";

function CatDefs() {
  return (
    <defs>
      <linearGradient id="furG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={F} />
        <stop offset="60%" stopColor={F} />
        <stop offset="100%" stopColor={FD} />
      </linearGradient>
      <linearGradient id="bellyG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={FB} />
        <stop offset="100%" stopColor="#F0E4CC" />
      </linearGradient>
      <radialGradient id="cheekG" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={N} stopOpacity="0.5" />
        <stop offset="100%" stopColor={N} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Leg({ x, top, bot, w = 5, dx = 0 }: { x: number; top: number; bot: number; w?: number; dx?: number }) {
  const d = `M${x - w / 2} ${top} L${x + dx - w / 2} ${bot} L${x + dx + w / 2} ${bot} L${x + w / 2} ${top} Z`;
  return (
    <g>
      <path d={d} fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <ellipse cx={x + dx} cy={bot + 1} rx={w / 2 + 0.5} ry={1.6} fill={FB} stroke={O} strokeWidth={0.9} />
    </g>
  );
}

function Eye({ cx, cy, closed = false }: { cx: number; cy: number; closed?: boolean }) {
  if (closed) {
    return <path d={`M${cx - 3} ${cy} Q${cx} ${cy + 2.2} ${cx + 3} ${cy}`} stroke={O} strokeWidth={1.4} strokeLinecap="round" fill="none" />;
  }
  return (
    <g>
      <path d={`M${cx - 3.2} ${cy} Q${cx} ${cy - 3} ${cx + 3.2} ${cy} Q${cx} ${cy + 1.4} ${cx - 3.2} ${cy} Z`} fill={W} stroke={O} strokeWidth={1} />
      <ellipse cx={cx} cy={cy} rx={1.7} ry={2.4} fill={E} />
      <ellipse cx={cx} cy={cy + 0.4} rx={0.9} ry={1.6} fill="#1A1A1A" />
      <circle cx={cx + 0.8} cy={cy - 1.2} r={0.7} fill={W} />
    </g>
  );
}

function Face({ cx, cy, closed = false, dir = 1 }: { cx: number; cy: number; closed?: boolean; dir?: number }) {
  const s = dir;
  return (
    <g>
      <ellipse cx={cx - 2 * s} cy={cy + 2.5} rx={4.5} ry={3} fill="url(#cheekG)" />
      <Eye cx={cx + 1 * s} cy={cy - 1} closed={closed} />
      <path d={`M${cx + 3.5 * s} ${cy + 1.5} L${cx + 5.5 * s} ${cy + 3.5} L${cx + 3.2 * s} ${cy + 3.8} Z`} fill={N} stroke={O} strokeWidth={0.7} strokeLinejoin="round" />
      <path d={`M${cx + 3.4 * s} ${cy + 3.8} Q${cx + 1.5 * s} ${cy + 5.5} ${cx - 0.5 * s} ${cy + 4.8}`} stroke={O} strokeWidth={0.9} strokeLinecap="round" fill="none" />
      <path d={`M${cx + 3.4 * s} ${cy + 3.8} Q${cx + 5 * s} ${cy + 5.5} ${cx + 7 * s} ${cy + 4.8}`} stroke={O} strokeWidth={0.9} strokeLinecap="round" fill="none" />
      <g stroke={O} strokeWidth={0.55} strokeLinecap="round" opacity={0.45}>
        <line x1={cx - 1 * s} y1={cy + 2.5} x2={cx - 7 * s} y2={cy + 1.5} />
        <line x1={cx - 1 * s} y1={cy + 3.5} x2={cx - 7 * s} y2={cy + 4} />
        <line x1={cx + 5 * s} y1={cy + 2.5} x2={cx + 10 * s} y2={cy + 1.5} />
        <line x1={cx + 5 * s} y1={cy + 3.5} x2={cx + 10 * s} y2={cy + 4} />
      </g>
    </g>
  );
}

function Head({ cx, cy, dir = 1, closed = false }: { cx: number; cy: number; dir?: number; closed?: boolean }) {
  const s = dir;
  return (
    <g>
      <path
        d={`M${cx - 8 * s} ${cy + 2} C${cx - 10 * s} ${cy - 6}, ${cx - 4 * s} ${cy - 11}, ${cx + 2 * s} ${cy - 10} C${cx + 8 * s} ${cy - 10}, ${cx + 11 * s} ${cy - 4}, ${cx + 10 * s} ${cy + 3} C${cx + 9 * s} ${cy + 7}, ${cx + 3 * s} ${cy + 9}, ${cx - 4 * s} ${cy + 8} C${cx - 9 * s} ${cy + 7}, ${cx - 10 * s} ${cy + 4}, ${cx - 8 * s} ${cy + 2} Z`}
        fill="url(#furG)"
        stroke={O}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d={`M${cx - 6 * s} ${cy - 7} L${cx - 4 * s} ${cy - 15} L${cx + 1 * s} ${cy - 9} Z`} fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={`M${cx + 4 * s} ${cy - 9} L${cx + 7 * s} ${cy - 15} L${cx + 9 * s} ${cy - 7} Z`} fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={`M${cx - 4.5 * s} ${cy - 10} L${cx - 3 * s} ${cy - 13} L${cx - 0.5 * s} ${cy - 9.5} Z`} fill={N} opacity={0.75} />
      <path d={`M${cx + 5 * s} ${cy - 10} L${cx + 6.5 * s} ${cy - 13} L${cx + 8 * s} ${cy - 9.5} Z`} fill={N} opacity={0.75} />
      <Face cx={cx} cy={cy} closed={closed} dir={s} />
      <path d={`M${cx - 6 * s} ${cy - 6} Q${cx - 3 * s} ${cy - 8} ${cx * s} ${cy - 7}`} fill="none" stroke={FD} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      <path d={`M${cx + 2 * s} ${cy - 7.5} Q${cx + 5 * s} ${cy - 8.5} ${cx + 8 * s} ${cy - 6.5}`} fill="none" stroke={FD} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Tail({ sx: _sx, sy: _sy, d, w = 9 }: { sx: number; sy: number; d: string; w?: number }) {
  return (
    <g>
      <path d={d} stroke={O} strokeWidth={w + 1.6} strokeLinecap="round" fill="none" />
      <path d={d} stroke="url(#furG)" strokeWidth={w} strokeLinecap="round" fill="none" />
      <path d={d} stroke={FD} strokeWidth={w * 0.35} strokeLinecap="round" fill="none" strokeDasharray="4 7" opacity={0.6} />
    </g>
  );
}

function Stripes({ paths }: { paths: string[] }) {
  return (
    <g stroke={FD} strokeWidth={1.8} strokeLinecap="round" fill="none" opacity={0.75}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

const BELLY_IDLE = "M 30 43 C 40 45, 52 45.5, 60 44 C 58 47, 48 48, 30 46 Z";

const POSES: Record<CatPose, () => ReactNode> = {
  idle: () => (
    <g>
      <Tail sx={22} sy={36} d="M 22 36 C 15 31, 8 22, 6 13 C 5 7, 10 4, 14 6" w={9} />
      <path d="M 64 31 C 58 25, 48 24, 38 26 C 30 28, 24 31, 21 35 C 19 38, 20 42, 25 43 C 35 45, 48 45.5, 58 44 C 64 43, 67 39, 67 34 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={BELLY_IDLE} fill="url(#bellyG)" />
      <Stripes paths={["M 34 29 Q 38 27 42 29", "M 44 28 Q 48 26 52 28", "M 52 29 Q 56 27 60 29"]} />
      <Leg x={30} top={43} bot={60} />
      <Leg x={36} top={43} bot={60} />
      <Leg x={58} top={44} bot={60} />
      <Leg x={64} top={44} bot={60} />
      <Head cx={74} cy={27} dir={1} />
    </g>
  ),

  walk: () => (
    <g>
      <Tail sx={20} sy={35} d="M 20 35 C 13 30, 6 20, 5 10 C 5 5, 9 3, 13 5" w={9} />
      <path d="M 62 29 C 56 24, 46 23, 36 25 C 28 27, 22 30, 19 34 C 17 37, 18 41, 23 42 C 33 44, 46 44.5, 56 43 C 62 42, 65 38, 65 33 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" transform="rotate(-3 42 34)" />
      <path d="M 28 42 C 38 44, 50 44.5, 58 43 C 56 46, 46 47, 28 45 Z" fill="url(#bellyG)" transform="rotate(-3 42 34)" />
      <Stripes paths={["M 34 28 Q 38 26 42 28", "M 44 27 Q 48 25 52 27"]} />
      <Leg x={28} top={42} bot={60} dx={-2} />
      <Leg x={34} top={42} bot={60} dx={1} />
      <Leg x={56} top={43} bot={60} dx={2} />
      <Leg x={62} top={43} bot={60} dx={-1} />
      <Head cx={72} cy={25} dir={1} />
    </g>
  ),

  sit: () => (
    <g>
      <Tail sx={50} sy={48} d="M 50 48 C 56 44, 62 38, 64 30 C 65 24, 62 20, 58 21" w={9} />
      <path d="M 26 60 C 24 44, 30 34, 42 33 C 54 33, 58 42, 56 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 32 60 C 31 46, 35 39, 42 38 C 49 38, 52 46, 50 60 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 32 42 Q 36 40 40 42", "M 42 40 Q 46 38 50 41"]} />
      <Leg x={32} top={54} bot={60} w={6} />
      <Leg x={50} top={54} bot={60} w={6} />
      <path d="M 28 60 L 26 50 L 31 49 L 33 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 52 60 L 51 50 L 56 49 L 57 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <ellipse cx={28} cy={60} rx={3} ry={1.6} fill={FB} stroke={O} strokeWidth={0.9} />
      <ellipse cx={54} cy={60} rx={3} ry={1.6} fill={FB} stroke={O} strokeWidth={0.9} />
      <Head cx={42} cy={26} dir={1} />
    </g>
  ),

  lie: () => (
    <g>
      <Tail sx={80} sy={50} d="M 80 50 C 86 46, 92 40, 94 32 C 95 26, 92 22, 88 23" w={8} />
      <path d="M 18 52 C 16 46, 22 42, 34 41 C 50 40, 66 41, 76 44 C 82 46, 82 52, 76 54 C 60 56, 40 56, 24 55 C 19 54, 17 53, 18 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 26 54 C 40 55.5, 60 55.5, 74 54 C 70 57, 50 57.5, 28 56 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 30 47 Q 34 45 38 47", "M 42 46 Q 46 44 50 46", "M 54 46 Q 58 44 62 46", "M 64 47 Q 68 45 72 47"]} />
      <path d="M 20 52 L 18 56 L 24 56 L 26 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 28 54 L 27 58 L 33 58 L 34 54 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 60 54 L 59 58 L 65 58 L 66 54 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 68 52 L 67 56 L 73 56 L 74 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <Head cx={18} cy={46} dir={-1} />
    </g>
  ),

  sleep: () => (
    <g>
      <Tail sx={78} sy={50} d="M 78 50 C 84 48, 90 46, 92 40 C 93 35, 90 32, 86 33" w={8} />
      <path d="M 14 52 C 12 44, 20 38, 36 37 C 54 36, 72 39, 80 44 C 84 47, 82 53, 74 54 C 56 56, 30 55, 18 54 C 14 53, 13 52, 14 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 24 54 C 40 55, 60 55, 76 53 C 72 56, 50 57, 26 56 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 28 46 Q 32 44 36 46", "M 42 45 Q 46 43 50 45", "M 56 45 Q 60 43 64 45"]} />
      <path d="M 16 52 L 14 56 L 20 56 L 22 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 64 53 L 63 57 L 69 57 L 70 53 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <Head cx={16} cy={46} dir={-1} closed />
      <g fill={O} opacity={0.5} fontFamily="serif" fontStyle="italic">
        <text x="40" y="30" fontSize="8">z</text>
        <text x="48" y="24" fontSize="11">z</text>
        <text x="58" y="17" fontSize="15">Z</text>
      </g>
    </g>
  ),

  stretch: () => (
    <g>
      <Tail sx={82} sy={40} d="M 82 40 C 88 36, 94 28, 95 18 C 95 12, 92 9, 88 11" w={9} />
      <path d="M 10 52 C 8 46, 14 40, 26 37 C 42 34, 60 34, 74 37 C 82 39, 84 46, 80 52 C 60 54, 30 54, 10 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 18 52 C 40 53, 64 53, 78 51 C 74 54, 40 55, 20 54 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 28 42 Q 32 40 36 42", "M 44 40 Q 48 38 52 40", "M 60 40 Q 64 38 68 40"]} />
      <path d="M 8 52 L 4 58 L 12 58 L 14 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 18 53 L 16 58 L 24 58 L 26 53 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 68 53 L 66 58 L 74 58 L 76 53 Z" fill="url(#furG)" stroke={O} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M 78 52 L 76 58 L 84 58 L 86 52 Z" fill="url(#furG)" stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <Head cx={6} cy={46} dir={-1} />
    </g>
  ),

  groom: () => (
    <g>
      <Tail sx={50} sy={48} d="M 50 48 C 56 44, 62 38, 64 30 C 65 24, 62 20, 58 21" w={9} />
      <path d="M 26 60 C 24 44, 30 34, 42 33 C 54 33, 58 42, 56 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 32 60 C 31 46, 35 39, 42 38 C 49 38, 52 46, 50 60 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 32 42 Q 36 40 40 42", "M 42 40 Q 46 38 50 41"]} />
      <Leg x={32} top={54} bot={60} w={6} />
      <Leg x={50} top={54} bot={60} w={6} />
      <path d="M 28 60 L 26 50 L 31 49 L 33 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 52 60 L 51 50 L 56 49 L 57 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <g transform="rotate(40 42 30)">
        <Head cx={42} cy={24} dir={1} />
      </g>
      <path d="M 30 44 Q 26 50 28 56" stroke={O} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M 30 44 Q 26 50 28 56" stroke="url(#furG)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <g stroke={O} strokeWidth={0.5} strokeLinecap="round" opacity={0.6}>
        <line x1="26" y1="48" x2="23" y2="46" />
        <line x1="25" y1="51" x2="22" y2="51" />
        <line x1="26" y1="54" x2="23" y2="55" />
      </g>
    </g>
  ),

  play: () => (
    <g transform="rotate(-20 50 45)">
      <Tail sx={76} sy={40} d="M 76 40 C 82 34, 88 26, 90 16 C 90 10, 86 8, 82 11" w={9} />
      <path d="M 22 44 C 20 36, 28 30, 42 29 C 58 28, 70 33, 74 40 C 76 46, 72 52, 64 53 C 48 55, 30 54, 24 51 C 21 49, 21 46, 22 44 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 30 50 C 44 52, 60 51, 70 49 C 66 53, 44 54, 32 53 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 32 38 Q 36 36 40 38", "M 46 36 Q 50 34 54 36", "M 58 37 Q 62 35 66 37"]} />
      <Leg x={28} top={50} bot={58} dx={-3} />
      <Leg x={36} top={51} bot={58} dx={-2} />
      <Leg x={58} top={52} bot={58} dx={2} />
      <Leg x={66} top={51} bot={58} dx={3} />
      <Head cx={74} cy={32} dir={1} />
    </g>
  ),

  jump: () => (
    <g>
      <Tail sx={24} sy={34} d="M 24 34 C 18 28, 12 18, 10 8 C 10 3, 14 1, 18 4" w={9} />
      <path d="M 62 28 C 56 22, 46 21, 36 23 C 28 25, 22 28, 19 32 C 17 35, 19 39, 24 40 C 34 42, 46 42, 56 41 C 62 40, 65 36, 65 31 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" transform="rotate(-6 42 32)" />
      <path d="M 28 40 C 38 42, 50 42, 58 41 C 56 44, 46 45, 30 43 Z" fill="url(#bellyG)" transform="rotate(-6 42 32)" />
      <Stripes paths={["M 34 27 Q 38 25 42 27", "M 44 26 Q 48 24 52 26"]} />
      <path d="M 28 40 L 22 52 L 28 53 L 32 41 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 36 41 L 32 54 L 38 55 L 40 42 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 54 41 L 52 54 L 58 55 L 60 42 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 62 40 L 60 52 L 66 53 L 68 41 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <Head cx={72} cy={23} dir={1} />
    </g>
  ),

  fall: () => (
    <g>
      <Tail sx={22} sy={36} d="M 22 36 C 16 40, 10 46, 8 54 C 8 60, 12 62, 16 60" w={9} />
      <path d="M 64 31 C 58 25, 48 24, 38 26 C 30 28, 24 31, 21 35 C 19 38, 20 42, 25 43 C 35 45, 48 45.5, 58 44 C 64 43, 67 39, 67 34 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={BELLY_IDLE} fill="url(#bellyG)" />
      <Stripes paths={["M 34 29 Q 38 27 42 29", "M 44 28 Q 48 26 52 28"]} />
      <path d="M 28 43 L 22 54 L 28 55 L 32 44 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 36 44 L 34 56 L 40 57 L 40 44 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 54 44 L 52 56 L 58 57 L 60 44 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 62 44 L 60 54 L 66 55 L 68 43 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <Head cx={74} cy={27} dir={1} />
    </g>
  ),

  yawn: () => (
    <g>
      <Tail sx={50} sy={48} d="M 50 48 C 56 44, 62 38, 64 30 C 65 24, 62 20, 58 21" w={9} />
      <path d="M 26 60 C 24 44, 30 34, 42 33 C 54 33, 58 42, 56 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M 32 60 C 31 46, 35 39, 42 38 C 49 38, 52 46, 50 60 Z" fill="url(#bellyG)" />
      <Stripes paths={["M 32 42 Q 36 40 40 42", "M 42 40 Q 46 38 50 41"]} />
      <Leg x={32} top={54} bot={60} w={6} />
      <Leg x={50} top={54} bot={60} w={6} />
      <path d="M 28 60 L 26 50 L 31 49 L 33 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <path d="M 52 60 L 51 50 L 56 49 L 57 60 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
      <g>
        <path d={`M 66 21 C 64 13, 70 8, 76 7 C 82 7, 86 12, 84 19 C 83 23, 77 25, 70 24 C 67 23, 65 22, 66 21 Z`} fill="url(#furG)" stroke={O} strokeWidth={1.4} strokeLinejoin="round" />
        <path d="M 68 17 L 70 9 L 74 15 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M 78 15 L 82 9 L 84 17 Z" fill="url(#furG)" stroke={O} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M 68 13 L 70 10 L 73 14 Z" fill={N} opacity={0.75} />
        <path d="M 79 14 L 81 10 L 83 14 Z" fill={N} opacity={0.75} />
        <Eye cx={75} cy={18} />
        <ellipse cx={75} cy={23} rx={4.5} ry={4} fill={N} stroke={O} strokeWidth={1} />
        <ellipse cx={75} cy={24} rx={3} ry={2.8} fill="#C46A6A" />
        <path d="M 71 26 L 75 27.5 L 79 26" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
        <path d="M 66 16 Q 70 14 74 16" fill="none" stroke={FD} strokeWidth={1.5} strokeLinecap="round" opacity={0.8} />
      </g>
    </g>
  ),
};

export function PoseArt({ pose }: { pose: CatPose }) {
  return (
    <>
      <CatDefs />
      {POSES[pose]()}
    </>
  );
}
