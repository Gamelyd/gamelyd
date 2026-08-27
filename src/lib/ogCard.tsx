import { ds } from "@/lib/designSystem";

/** Markup for Next.js ImageResponse cards. Every node must use display:flex. */

export function DefaultOgMarkup({
  kicker = "Gamelyd",
  title = "Host and join game tournaments",
  subtitle = "Knockout · Groups · League · Battle Royale",
}: {
  kicker?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: ds.bgPrimary,
        color: "white",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <div
        style={{
          display: "flex",
          color: ds.primary,
          fontSize: 28,
          letterSpacing: 8,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.1,
          marginTop: 20,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          color: ds.textMuted,
          fontSize: 28,
          marginTop: 24,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

export function EntityOgMarkup({
  image,
  kicker,
  title,
  subtitle,
}: {
  image: string;
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: ds.bgPrimary,
        color: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 520,
          height: 630,
          background: ds.bgPrimary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          width={520}
          height={630}
          style={{ objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          padding: 56,
        }}
      >
        <div
          style={{
            display: "flex",
            color: ds.primary,
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 52,
            lineHeight: 1.1,
            marginTop: 16,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              color: ds.textMuted,
              fontSize: 24,
              marginTop: 24,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
