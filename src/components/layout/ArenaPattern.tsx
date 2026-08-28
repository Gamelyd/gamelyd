"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/** Change these to restyle the hex field everywhere `ArenaPattern` is used. */
export const ARENA_PATTERN = {
  color: "var(--ds-text-muted)",
  opacity: 0.16,
  litColor: "var(--ds-primary)",
  litOpacity: 0.42,
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
  const host = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const height = size * HEX_RATIO;
  const scale = size / HEX_BASE;
  const driftClass = drift ? "arena-pattern-drift" : "h-full w-full";

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const onMove = (event: MouseEvent) => {
      const el = host.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      setPos({ x: event.clientX - box.left, y: event.clientY - box.top });
    };
    const onLeave = () => setPos(null);

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={host}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={
        {
          "--arena-cell": `${size}px`,
          "--arena-cell-y": `${height}px`,
        } as CSSProperties
      }
      aria-hidden
    >
      <div className={driftClass}>
        <HexField
          patternId={`arena-hex-${rawId}`}
          color={color}
          opacity={opacity}
          size={size}
          height={height}
          scale={scale}
        />
      </div>
      <div
        className="arena-hex-lit absolute inset-0 overflow-hidden"
        style={
          pos
            ? {
                opacity: 1,
                maskImage: `radial-gradient(circle 12rem at ${pos.x}px ${pos.y}px, #000 0%, transparent 72%)`,
                WebkitMaskImage: `radial-gradient(circle 12rem at ${pos.x}px ${pos.y}px, #000 0%, transparent 72%)`,
              }
            : { opacity: 0 }
        }
      >
        <div className={driftClass}>
          <HexField
            patternId={`arena-hex-lit-${rawId}`}
            color={ARENA_PATTERN.litColor}
            opacity={ARENA_PATTERN.litOpacity}
            size={size}
            height={height}
            scale={scale}
          />
        </div>
      </div>
      {vignette ? <div className="arena-pattern-vignette" /> : null}
    </div>
  );
}

function HexField({
  patternId,
  color,
  opacity,
  size,
  height,
  scale,
}: {
  patternId: string;
  color: string;
  opacity: number;
  size: number;
  height: number;
  scale: number;
}) {
  return (
    <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
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
  );
}
