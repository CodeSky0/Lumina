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

export const CAT_DIM = { w: 80, h: 64 };

const F = "var(--cat-fur, #F4A261)";
const FD = "var(--cat-fur-dark, #D9792A)";
const FB = "var(--cat-belly, #FBF3E7)";
const N = "var(--cat-nose, #E8A0A0)";
const E = "var(--cat-eye, #5B8C3A)";
const O = "var(--cat-outline, #6B3A1A)";
const W = "var(--cat-white, #FFFFFF)";

function Stripes({ d, x = 0, y = 0 }: { d: string; x?: number; y?: number }) {
  return <path d={d} fill={FD} opacity={0.9} transform={`translate(${x} ${y})`} />;
}

function FaceFront({ cx, cy, r, closed = false }: { cx: number; cy: number; r: number; closed?: boolean }) {
  const earL = `${cx - r * 0.7},${cy - r * 0.55} ${cx - r * 0.95},${cy - r * 1.25} ${cx - r * 0.25},${cy - r * 0.95}`;
  const earR = `${cx + r * 0.7},${cy - r * 0.55} ${cx + r * 0.95},${cy - r * 1.25} ${cx + r * 0.25},${cy - r * 0.95}`;
  return (
    <g>
      <polygon points={earL} fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <polygon points={earR} fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
      <polygon points={earL} fill={N} opacity={0.7} transform={`translate(${cx - r * 0.55} ${cy - r * 0.45}) scale(0.45)`} />
      <polygon points={earR} fill={N} opacity={0.7} transform={`translate(${cx + r * 0.15} ${cy - r * 0.45}) scale(0.45)`} />
      <circle cx={cx - r * 0.42} cy={cy - r * 0.05} r={r * 0.2} fill={W} stroke={O} strokeWidth={0.8} />
      <circle cx={cx + r * 0.42} cy={cy - r * 0.05} r={r * 0.2} fill={W} stroke={O} strokeWidth={0.8} />
      {closed ? (
        <>
          <path d={`M${cx - r * 0.55} ${cy - r * 0.05} q${r * 0.25} ${r * 0.18} ${r * 0.5} 0`} stroke={O} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          <path d={`M${cx + r * 0.05} ${cy - r * 0.05} q${r * 0.25} ${r * 0.18} ${r * 0.5} 0`} stroke={O} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx={cx - r * 0.42} cy={cy - r * 0.05} r={r * 0.1} fill={E} />
          <circle cx={cx + r * 0.42} cy={cy - r * 0.05} r={r * 0.1} fill={E} />
          <circle cx={cx - r * 0.38} cy={cy - r * 0.1} r={r * 0.04} fill={W} />
          <circle cx={cx + r * 0.46} cy={cy - r * 0.1} r={r * 0.04} fill={W} />
        </>
      )}
      <path d={`M${cx - r * 0.18} ${cy + r * 0.28} L${cx} ${cy + r * 0.42} L${cx + r * 0.18} ${cy + r * 0.28} Z`} fill={N} stroke={O} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M${cx} ${cy + r * 0.42} L${cx} ${cy + r * 0.58}`} stroke={O} strokeWidth={1} strokeLinecap="round" />
      <path d={`M${cx} ${cy + r * 0.58} Q${cx - r * 0.18} ${cy + r * 0.66} ${cx - r * 0.3} ${cy + r * 0.56}`} stroke={O} strokeWidth={1} strokeLinecap="round" fill="none" />
      <path d={`M${cx} ${cy + r * 0.58} Q${cx + r * 0.18} ${cy + r * 0.66} ${cx + r * 0.3} ${cy + r * 0.56}`} stroke={O} strokeWidth={1} strokeLinecap="round" fill="none" />
      <g stroke={O} strokeWidth={0.6} strokeLinecap="round" opacity={0.5}>
        <line x1={cx - r * 0.5} y1={cy + r * 0.2} x2={cx - r * 1.1} y2={cy + r * 0.12} />
        <line x1={cx - r * 0.5} y1={cy + r * 0.32} x2={cx - r * 1.1} y2={cy + r * 0.36} />
        <line x1={cx + r * 0.5} y1={cy + r * 0.2} x2={cx + r * 1.1} y2={cy + r * 0.12} />
        <line x1={cx + r * 0.5} y1={cy + r * 0.32} x2={cx + r * 1.1} y2={cy + r * 0.36} />
      </g>
    </g>
  );
}

function Tail({ sx, sy, curl = 0, flip = false }: { sx: number; sy: number; curl?: number; flip?: boolean }) {
  const c = curl;
  const d = `M${sx} ${sy} C${sx + 6} ${sy - 14 - c} ${sx + 16} ${sy - 22 - c} ${sx + 24} ${sy - 30 - c} C${sx + 30} ${sy - 36 - c} ${sx + 32} ${sy - 44 - c} ${sx + 26} ${sy - 50 - c}`;
  return (
    <g transform={flip ? `translate(${sx * 2 + 26} 0) scale(-1 1)` : undefined}>
      <path d={d} stroke={O} strokeWidth={9} strokeLinecap="round" fill="none" />
      <path d={d} stroke={F} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d={d} stroke={FD} strokeWidth={2.5} strokeLinecap="round" fill="none" strokeDasharray="3 6" opacity={0.7} />
    </g>
  );
}

const POSES: Record<CatPose, () => ReactNode> = {
  idle: () => (
    <g>
      <Tail sx={56} sy={42} curl={2} />
      <ellipse cx={40} cy={42} rx={20} ry={15} fill={F} stroke={O} strokeWidth={1.4} />
      <ellipse cx={40} cy={46} rx={13} ry={9} fill={FB} />
      <ellipse cx={28} cy={54} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={52} cy={54} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={28} cy={55} rx={2} ry={1.4} fill={N} />
      <ellipse cx={52} cy={55} rx={2} ry={1.4} fill={N} />
      <Stripes d="M30 32 q6 -4 12 0 M44 30 q6 -3 10 1 M28 44 q8 -2 14 1" />
      <circle cx={40} cy={24} r={13} fill={F} stroke={O} strokeWidth={1.4} />
      <FaceFront cx={40} cy={24} r={13} />
      <path d="M33 16 q5 -3 9 0 M42 16 q5 -2 8 1" fill={FD} opacity={0.8} />
    </g>
  ),

  walk: () => (
    <g>
      <Tail sx={56} sy={40} curl={6} />
      <ellipse cx={38} cy={40} rx={21} ry={14} fill={F} stroke={O} strokeWidth={1.4} transform="rotate(-4 38 40)" />
      <ellipse cx={38} cy={44} rx={13} ry={8} fill={FB} transform="rotate(-4 38 40)" />
      <ellipse cx={24} cy={54} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={36} cy={50} rx={4.5} ry={3.5} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-20 36 50)" />
      <ellipse cx={48} cy={54} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={58} cy={50} rx={4.5} ry={3.5} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(25 58 50)" />
      <Stripes d="M28 32 q6 -4 12 0 M42 30 q6 -3 10 1" />
      <circle cx={46} cy={22} r={13} fill={F} stroke={O} strokeWidth={1.4} />
      <FaceFront cx={46} cy={22} r={13} />
      <path d="M39 14 q5 -3 9 0 M48 14 q5 -2 8 1" fill={FD} opacity={0.8} />
    </g>
  ),

  sit: () => (
    <g>
      <Tail sx={54} sy={46} curl={-4} />
      <path d="M22 56 Q22 36 40 34 Q58 36 58 56 Z" fill={F} stroke={O} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M28 56 Q28 42 40 40 Q52 42 52 56 Z" fill={FB} />
      <ellipse cx={30} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={50} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={34} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={46} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={34} cy={54} rx={2} ry={1.4} fill={N} />
      <ellipse cx={46} cy={54} rx={2} ry={1.4} fill={N} />
      <Stripes d="M28 42 q6 -3 12 0 M42 40 q6 -2 10 1" />
      <circle cx={40} cy={26} r={13} fill={F} stroke={O} strokeWidth={1.4} />
      <FaceFront cx={40} cy={26} r={13} />
      <path d="M33 18 q5 -3 9 0 M42 18 q5 -2 8 1" fill={FD} opacity={0.8} />
    </g>
  ),

  lie: () => (
    <g>
      <Tail sx={62} sy={42} curl={8} />
      <ellipse cx={40} cy={44} rx={26} ry={11} fill={F} stroke={O} strokeWidth={1.4} />
      <ellipse cx={40} cy={47} rx={20} ry={6} fill={FB} />
      <ellipse cx={20} cy={48} rx={6} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={28} cy={52} rx={4} ry={3} fill={F} stroke={O} strokeWidth={1.1} />
      <ellipse cx={38} cy={52} rx={4} ry={3} fill={F} stroke={O} strokeWidth={1.1} />
      <ellipse cx={48} cy={52} rx={4} ry={3} fill={F} stroke={O} strokeWidth={1.1} />
      <ellipse cx={56} cy={52} rx={4} ry={3} fill={F} stroke={O} strokeWidth={1.1} />
      <Stripes d="M26 40 q8 -3 14 0 M44 38 q8 -2 14 1 M30 46 q10 -2 16 1" />
      <circle cx={16} cy={40} r={10} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="11,35 8,28 16,33" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="21,35 24,28 16,33" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="11,35 9,32 14,34" fill={N} opacity={0.7} />
        <polygon points="21,35 23,32 18,34" fill={N} opacity={0.7} />
        <circle cx={13} cy={40} r={1.8} fill={E} />
        <circle cx={19} cy={40} r={1.8} fill={E} />
        <circle cx={13.5} cy={39.5} r={0.6} fill={W} />
        <circle cx={19.5} cy={39.5} r={0.6} fill={W} />
        <path d="M14 43 L16 44.5 L18 43 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M16 44.5 L16 46" stroke={O} strokeWidth={0.8} strokeLinecap="round" />
      </g>
    </g>
  ),

  sleep: () => (
    <g>
      <Tail sx={60} sy={40} curl={-6} />
      <path d="M16 48 Q16 34 40 32 Q64 34 64 48 Q64 52 40 52 Q16 52 16 48 Z" fill={F} stroke={O} strokeWidth={1.4} strokeLinejoin="round" />
      <ellipse cx={40} cy={46} rx={22} ry={5} fill={FB} />
      <Stripes d="M26 40 q8 -3 14 0 M44 38 q8 -2 14 1" />
      <circle cx={18} cy={42} r={9} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="13,38 10,32 17,36" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="23,38 26,32 19,36" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M13 43 q3 2 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M19 43 q3 2 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M15 46 L17 47.5 L19 46 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
      </g>
      <g fill={O} opacity={0.55} fontFamily="serif" fontStyle="italic">
        <text x="30" y="24" fontSize="9">z</text>
        <text x="36" y="18" fontSize="11">Z</text>
        <text x="44" y="12" fontSize="14">Z</text>
      </g>
    </g>
  ),

  stretch: () => (
    <g>
      <Tail sx={60} sy={40} curl={14} />
      <path d="M14 50 Q20 38 40 36 Q60 38 64 50" stroke={F} strokeWidth={20} strokeLinecap="round" fill="none" />
      <path d="M14 50 Q20 38 40 36 Q60 38 64 50" stroke={O} strokeWidth={21.4} strokeLinecap="round" fill="none" opacity={0.001} />
      <path d="M14 50 Q20 38 40 36 Q60 38 64 50" stroke={O} strokeWidth={1.4} fill="none" />
      <ellipse cx={40} cy={42} rx={11} ry={7} fill={FB} />
      <ellipse cx={14} cy={50} rx={4} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={22} cy={52} rx={3.5} ry={4.5} fill={F} stroke={O} strokeWidth={1.1} />
      <ellipse cx={56} cy={52} rx={3.5} ry={4.5} fill={F} stroke={O} strokeWidth={1.1} />
      <ellipse cx={64} cy={50} rx={4} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <Stripes d="M30 36 q6 -2 12 0 M44 35 q6 -1 10 1" />
      <circle cx={10} cy={44} r={10} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="5,40 2,33 9,37" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="15,40 18,33 11,37" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <circle cx={7} cy={44} r={1.6} fill={E} />
        <circle cx={13} cy={44} r={1.6} fill={E} />
        <path d="M8 47 L10 48.5 L12 47 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M10 48.5 L10 50" stroke={O} strokeWidth={0.8} strokeLinecap="round" />
        <path d="M10 50 Q8 51 6 50.5" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
        <path d="M10 50 Q12 51 14 50.5" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
      </g>
    </g>
  ),

  groom: () => (
    <g>
      <Tail sx={54} sy={46} curl={-2} />
      <path d="M22 56 Q22 36 40 34 Q58 36 58 56 Z" fill={F} stroke={O} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M28 56 Q28 42 40 40 Q52 42 52 56 Z" fill={FB} />
      <ellipse cx={30} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={50} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={34} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={46} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <Stripes d="M28 42 q6 -3 12 0 M42 40 q6 -2 10 1" />
      <circle cx={40} cy={32} r={13} fill={F} stroke={O} strokeWidth={1.4} transform="rotate(35 40 38)" />
      <g transform="rotate(35 40 38)">
        <polygon points="33,26 30,19 37,24" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="47,26 50,19 43,24" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M33 32 q3 2 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M42 32 q3 2 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M37 36 L40 37.5 L43 36 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
      </g>
      <path d="M30 44 Q26 48 28 54" stroke={O} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M30 44 Q26 48 28 54" stroke={F} strokeWidth={3} strokeLinecap="round" fill="none" />
      <g stroke={O} strokeWidth={0.5} strokeLinecap="round" opacity={0.6}>
        <line x1="26" y1="46" x2="23" y2="44" />
        <line x1="25" y1="49" x2="22" y2="49" />
        <line x1="26" y1="52" x2="23" y2="53" />
      </g>
    </g>
  ),

  play: () => (
    <g transform="rotate(-25 40 40)">
      <Tail sx={58} sy={40} curl={18} />
      <ellipse cx={40} cy={40} rx={20} ry={16} fill={F} stroke={O} strokeWidth={1.4} />
      <ellipse cx={40} cy={34} rx={14} ry={9} fill={FB} />
      <ellipse cx={22} cy={42} rx={4.5} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-30 22 42)" />
      <ellipse cx={58} cy={42} rx={4.5} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(30 58 42)" />
      <ellipse cx={30} cy={54} rx={4} ry={5.5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={50} cy={54} rx={4} ry={5.5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={30} cy={57} rx={2} ry={1.4} fill={N} />
      <ellipse cx={50} cy={57} rx={2} ry={1.4} fill={N} />
      <Stripes d="M28 38 q6 -3 12 0 M44 36 q6 -2 10 1" />
      <circle cx={40} cy={40} r={12} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="33,34 30,27 37,32" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="47,34 50,27 43,32" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <circle cx={35} cy={40} r={2.2} fill={W} stroke={O} strokeWidth={0.8} />
        <circle cx={45} cy={40} r={2.2} fill={W} stroke={O} strokeWidth={0.8} />
        <circle cx={35} cy={40} r={1.3} fill={E} />
        <circle cx={45} cy={40} r={1.3} fill={E} />
        <circle cx={35.5} cy={39.5} r={0.5} fill={W} />
        <circle cx={45.5} cy={39.5} r={0.5} fill={W} />
        <path d="M37 44 L40 45.5 L43 44 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
        <path d="M40 45.5 L40 47" stroke={O} strokeWidth={0.8} strokeLinecap="round" />
        <path d="M40 47 Q37 49 35 47.5" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
        <path d="M40 47 Q43 49 45 47.5" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
      </g>
    </g>
  ),

  jump: () => (
    <g>
      <Tail sx={56} sy={36} curl={20} />
      <ellipse cx={40} cy={34} rx={22} ry={12} fill={F} stroke={O} strokeWidth={1.4} transform="rotate(-8 40 34)" />
      <ellipse cx={40} cy={37} rx={14} ry={7} fill={FB} transform="rotate(-8 40 34)" />
      <ellipse cx={20} cy={40} rx={4} ry={7} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-35 20 40)" />
      <ellipse cx={60} cy={40} rx={4} ry={7} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(35 60 40)" />
      <ellipse cx={28} cy={48} rx={4} ry={7} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-20 28 48)" />
      <ellipse cx={52} cy={48} rx={4} ry={7} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(20 52 48)" />
      <Stripes d="M28 30 q6 -3 12 0 M44 28 q6 -2 10 1" />
      <circle cx={44} cy={18} r={12} fill={F} stroke={O} strokeWidth={1.4} />
      <FaceFront cx={44} cy={18} r={12} />
      <path d="M37 10 q5 -3 9 0 M46 10 q5 -2 8 1" fill={FD} opacity={0.8} />
    </g>
  ),

  fall: () => (
    <g>
      <Tail sx={56} sy={40} curl={-10} />
      <ellipse cx={40} cy={38} rx={20} ry={14} fill={F} stroke={O} strokeWidth={1.4} />
      <ellipse cx={40} cy={42} rx={13} ry={8} fill={FB} />
      <ellipse cx={18} cy={36} rx={4} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-40 18 36)" />
      <ellipse cx={62} cy={36} rx={4} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(40 62 36)" />
      <ellipse cx={26} cy={50} rx={4} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(30 26 50)" />
      <ellipse cx={54} cy={50} rx={4} ry={6} fill={F} stroke={O} strokeWidth={1.2} transform="rotate(-30 54 50)" />
      <Stripes d="M28 32 q6 -3 12 0 M44 30 q6 -2 10 1" />
      <circle cx={40} cy={22} r={13} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="33,16 30,9 37,14" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="47,16 50,9 43,14" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <circle cx={35} cy={22} r={2.6} fill={W} stroke={O} strokeWidth={0.8} />
        <circle cx={45} cy={22} r={2.6} fill={W} stroke={O} strokeWidth={0.8} />
        <circle cx={35} cy={22} r={1.6} fill={E} />
        <circle cx={45} cy={22} r={1.6} fill={E} />
        <circle cx={35.5} cy={21.3} r={0.6} fill={W} />
        <circle cx={45.5} cy={21.3} r={0.6} fill={W} />
        <path d="M37 26 L40 27.5 L43 26 Z" fill={N} stroke={O} strokeWidth={0.6} strokeLinejoin="round" />
        <ellipse cx={40} cy={29} rx={3} ry={2} fill={N} stroke={O} strokeWidth={0.6} />
      </g>
    </g>
  ),

  yawn: () => (
    <g>
      <Tail sx={54} sy={46} curl={-4} />
      <path d="M22 56 Q22 36 40 34 Q58 36 58 56 Z" fill={F} stroke={O} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M28 56 Q28 42 40 40 Q52 42 52 56 Z" fill={FB} />
      <ellipse cx={30} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={50} cy={55} rx={5} ry={4} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={34} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <ellipse cx={46} cy={50} rx={3.5} ry={5} fill={F} stroke={O} strokeWidth={1.2} />
      <Stripes d="M28 42 q6 -3 12 0 M42 40 q6 -2 10 1" />
      <circle cx={40} cy={26} r={13} fill={F} stroke={O} strokeWidth={1.4} />
      <g>
        <polygon points="33,20 30,13 37,18" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="47,20 50,13 43,18" fill={F} stroke={O} strokeWidth={1.2} strokeLinejoin="round" />
        <polygon points="33,20 31,16 36,19" fill={N} opacity={0.7} />
        <polygon points="47,20 49,16 44,19" fill={N} opacity={0.7} />
        <path d="M34 24 q3 -1.5 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M42 24 q3 -1.5 5 0" stroke={O} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <ellipse cx={40} cy={31} rx={5} ry={4.5} fill={N} stroke={O} strokeWidth={1} />
        <ellipse cx={40} cy={32} rx={3.5} ry={3} fill="#C46A6A" />
        <path d="M37 35 L40 36.5 L43 35" stroke={O} strokeWidth={0.8} strokeLinecap="round" fill="none" />
      </g>
    </g>
  ),
};

export function PoseArt({ pose }: { pose: CatPose }) {
  return <>{POSES[pose]()}</>;
}
