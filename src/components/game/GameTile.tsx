import type { Game } from "@/lib/schemas/game";
import { CatalogImage } from "@/components/ui/CatalogImage";

export function GameTile({
  game,
  className = "",
}: {
  game: Game;
  className?: string;
}) {
  return (
    <article
      className={`create-game-card overflow-hidden rounded-2xl border border-primary/25 bg-primary-panel ${className}`}
    >
      <div className="relative aspect-4/3 bg-black">
        {game.image ? (
          <CatalogImage
            src={game.image}
            alt=""
            fill
            sizes="220px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="px-3 py-3">
        <p className="truncate font-display text-lg leading-none text-white">
          {game.name}
        </p>
        {game.formats?.length ? (
          <p className="mt-1 truncate text-[11px] text-body">
            {game.formats.map((row) => row.label).join(" · ")}
          </p>
        ) : game.platforms.length > 0 ? (
          <p className="mt-1 truncate text-[11px] text-body">
            {game.platforms.join(" · ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
