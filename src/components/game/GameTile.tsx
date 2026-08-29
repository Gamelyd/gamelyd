import type { Game } from "@/lib/schemas/game";
import { CatalogImage } from "@/components/ui/CatalogImage";

export function GameTile({
  game,
  className = "",
}: {
  game: Game;
  className?: string;
}) {
  const meta = game.formats?.length
    ? game.formats.map((row) => row.label).join(" · ")
    : game.platforms.length > 0
      ? game.platforms.join(" · ")
      : "";

  return (
    <article
      className={`create-game-card group relative aspect-4/3 overflow-hidden rounded-xl border border-primary/25 bg-surface-4 ${className}`}
    >
      {game.image ? (
        <CatalogImage
          src={game.image}
          alt={game.name}
          fill
          /*
           * Matches the widest place this renders: the games grid at
           * 2/3/4 columns. A fixed small `sizes` here made Next serve a
           * source narrower than the card, which the browser then upscaled -
           * that was the blur, not the artwork.
           */
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 300px"
          quality={90}
          className="z-0 object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : null}

      {/* Same gradient as the tournament card: dark enough at the foot to
          carry text, clear at the top so the art still reads. */}
      <div className="absolute inset-0 z-1 bg-linear-to-t from-black via-black/45 to-black/10" />

      <div className="absolute inset-x-0 bottom-0 z-2 px-3 py-3">
        <p className="line-clamp-1 font-display text-lg leading-tight text-white">
          {game.name}
        </p>
        {meta ? (
          <p className="mt-0.5 line-clamp-1 font-body text-[11px] text-white/70">
            {meta}
          </p>
        ) : null}
      </div>
    </article>
  );
}
