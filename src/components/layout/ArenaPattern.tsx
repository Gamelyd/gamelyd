import { useId } from "react";

/** Change these to restyle the hex field everywhere `ArenaPattern` is used. */
export const ARENA_PATTERN = {
  color: "#0bc0b4",
  opacity: 0.08,
  /** Hex cell width in px. Height scales with the hex (84 / 48). */
  size: 48,
  drift: true,
  vignette: true,
} as const;

const HEX_PATH = "M24 2 L46 15 L46 41 L24 54 L2 41 L2 15 Z";
const HEX_BASE = 48;
const HEX_RATIO = 84 / 48;

export function ArenaPattern({
  color = ARENA_PATTERN.color,
  opacity = ARENA_PATTERN.opacity,
  size = ARENA_PATTERN.size,
  drift = ARENA_PATTERN.drift,
  vignette = ARENA_PATTERN.vignette,
  className = "",
}: {
  color?: string;
  opacity?: number;
  size?: number;
  drift?: boolean;
  vignette?: boolean;
  className?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const patternId = `arena-hex-${rawId}`;
  const height = size * HEX_RATIO;
  const scale = size / HEX_BASE;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        className={drift ? "arena-pattern-drift" : "h-full w-full"}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id={patternId}
            width={size}
            height={height}
            patternUnits="userSpaceOnUse"
          >
            <g transform={`scale(${scale})`}>
              <path
                d={HEX_PATH}
                fill="none"
                stroke={color}
                strokeOpacity={opacity}
                strokeWidth="1"
              />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      {vignette ? <div className="arena-pattern-vignette" /> : null}
    </div>
  );
}
