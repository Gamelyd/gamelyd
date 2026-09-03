/*
 * Satori renders these cards, not the browser, so next/image has no role
 * here and a raw <img> is correct. The disable sits at file level because a
 * JSX comment inside an ImageResponse tree breaks the route.
 */
/* eslint-disable @next/next/no-img-element */
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
        justifyContent: "space-between",
        padding: 72,
      }}
    >
      {/* Wordmark, so a card lifted into a feed still says who it is from. */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            width: 14,
            height: 14,
            borderRadius: 7,
            background: ds.primary,
          }}
        />
        <div
          style={{
            display: "flex",
            marginLeft: 14,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "white",
          }}
        >
          Gamelyd
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            color: ds.primary,
            fontSize: 26,
            letterSpacing: 7,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.08,
            marginTop: 18,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            color: ds.textMuted,
            fontSize: 28,
            marginTop: 22,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: 220,
          height: 6,
          borderRadius: 3,
          background: ds.primary,
        }}
      />
    </div>
  );
}

/*
 * Crests are small square art, so this card centres one on a panel rather
 * than stretching it across half the canvas.
 *
 * Never put a JSX comment inside these trees. A comment node makes the
 * ImageResponse route return a non-Response and the card 500s.
 */
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
        alignItems: "center",
        padding: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 300,
          height: 300,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 24,
          background: ds.bgSecondary,
        }}
      >
        <img
          src={image}
          alt=""
          width={220}
          height={220}
          style={{ objectFit: "contain", borderRadius: 16 }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "center",
          marginLeft: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 12,
              height: 12,
              borderRadius: 6,
              background: ds.primary,
            }}
          />
          <div
            style={{
              display: "flex",
              marginLeft: 12,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
            }}
          >
            Gamelyd
          </div>
        </div>
        <div
          style={{
            display: "flex",
            color: ds.primary,
            fontSize: 26,
            letterSpacing: 5,
            textTransform: "uppercase",
            marginTop: 34,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            lineHeight: 1.06,
            marginTop: 14,
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
              fontSize: 26,
              marginTop: 20,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}
