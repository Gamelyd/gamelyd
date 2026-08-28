import Image from "next/image";

const HEX = "M24 2 L46 15 L46 41 L24 54 L2 41 L2 15 Z";
const APP_ICON = "/icon.png";

type LoaderVariant = "page" | "inline" | "compact";

export function Loader({
  variant = "inline",
  label = "Loading",
  fullscreen = false,
  className = "",
}: {
  variant?: LoaderVariant;
  label?: string;
  fullscreen?: boolean;
  className?: string;
}) {
  const compact = variant === "compact";
  const mark = <HudMark size={compact ? 40 : 88} />;

  const body = compact ? (
    mark
  ) : (
    <div className="arena-panel arena-hud-corners relative min-w-50 overflow-hidden px-8 py-7 text-center">
      <span className="hud-loader-scan" aria-hidden />
      <div className="relative z-1 flex flex-col items-center gap-4">
        {mark}
        <p className="font-display text-xl leading-none tracking-[0.28em] text-white uppercase">
          {label}
        </p>
        <span className="flex gap-1.5" aria-hidden>
          <span className="hud-loader-tick" />
          <span className="hud-loader-tick" />
          <span className="hud-loader-tick" />
        </span>
      </div>
    </div>
  );

  const wrapped = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        fullscreen
          ? "fixed inset-0 z-90 flex items-center justify-center bg-bg/80 backdrop-blur-sm"
          : variant === "page"
            ? "flex min-h-[calc(100vh-5rem)] items-center justify-center px-5 py-16"
            : compact
              ? "flex items-center justify-center py-4"
              : "flex items-center justify-center py-10"
      }
    >
      {body}
      <span className="sr-only">{label}</span>
    </div>
  );

  if (!className) return wrapped;
  return <div className={className}>{wrapped}</div>;
}

function HudMark({ size }: { size: number }) {
  const pad = Math.round(size * 0.46);
  return (
    <span
      className="hud-loader-mark relative grid place-items-center"
      style={{ width: size, height: Math.round(size * (56 / 48)) }}
      aria-hidden
    >
      <svg
        viewBox="0 0 48 56"
        className="hud-loader-svg pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <path className="hud-loader-ring" pathLength={1} d={HEX} />
        <g className="hud-loader-core-wrap">
          <path className="hud-loader-core" d={HEX} />
        </g>
      </svg>
      <Image
        src={APP_ICON}
        alt=""
        width={pad}
        height={pad}
        className="hud-loader-pad relative z-1 object-contain"
      />
    </span>
  );
}
