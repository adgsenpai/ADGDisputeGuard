// Deterministic, generated SVG avatars. No external services and no real
// people — each avatar is a warm two-tone gradient with a simple geometric
// motif and the persona's initials. The look is chosen deterministically from
// a seed so a given persona always renders the same avatar.

export type AvatarProps = {
  seed: string;
  initials: string;
  size?: number;
  rounded?: number; // border radius as a fraction of size (0 = square, 0.5 = circle)
  className?: string;
};

// Warm, earthy palettes (from -> to) inspired by African textiles.
const PALETTES: [string, string][] = [
  ["#E8703A", "#B8322B"], // terracotta -> red clay
  ["#F2A541", "#E26D1E"], // amber -> burnt orange
  ["#2A9D8F", "#1D6A5E"], // teal -> deep green
  ["#8E5BF0", "#5B2EC2"], // violet -> indigo
  ["#E4B363", "#9C6B1E"], // gold -> ochre
  ["#3A86C8", "#1E4E8C"], // sky -> cobalt
  ["#E05780", "#A32B59"], // rose -> magenta
  ["#5FA052", "#2F6B2A"], // leaf -> forest
];

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function Avatar({ seed, initials, size = 44, rounded = 0.32, className }: AvatarProps) {
  const h = hashSeed(seed);
  const [from, to] = PALETTES[h % PALETTES.length];
  const angle = (h >> 3) % 360;
  const motif = (h >> 5) % 3; // which geometric motif to draw
  const gid = `g${h.toString(36)}`;
  const r = size * rounded;
  const rad = (angle * Math.PI) / 180;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${initials} avatar`}
      style={{ display: "block", borderRadius: r, flex: "none" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={`${x2}%`} y2={`${y2}%`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx={rounded * 100} fill={`url(#${gid})`} />
      <g fill="#ffffff" opacity="0.14">
        {motif === 0 && (
          <>
            <circle cx="82" cy="20" r="26" />
            <circle cx="18" cy="86" r="18" />
          </>
        )}
        {motif === 1 && (
          <>
            <path d="M0 70 L30 100 L0 100 Z" />
            <path d="M100 0 L100 34 L66 0 Z" />
            <circle cx="78" cy="78" r="12" />
          </>
        )}
        {motif === 2 && (
          <>
            <rect x="60" y="-10" width="60" height="60" transform="rotate(45 90 20)" />
            <circle cx="20" cy="22" r="10" />
          </>
        )}
      </g>
      <text
        x="50"
        y="50"
        dy="0.35em"
        textAnchor="middle"
        fontFamily="'Manrope Variable', system-ui, sans-serif"
        fontSize="38"
        fontWeight="700"
        fill="#ffffff"
        style={{ letterSpacing: "0.5px" }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}
