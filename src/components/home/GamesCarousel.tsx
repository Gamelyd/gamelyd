"use client";

import { useRef } from "react";
import type { Game } from "@/lib/schemas/game";
import { GameTile } from "@/components/game/GameTile";

export function GamesCarousel({ games }: { games: Game[] }) {
  const scroller = useRef<HTMLUListElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {games.length > 3 ? (
        <>
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="absolute -left-2 top-1/2 z-2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-surface text-white shadow-lg hover:bg-primary hover:text-on-primary sm:grid"
            aria-label="Previous games"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="absolute -right-2 top-1/2 z-2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-surface text-white shadow-lg hover:bg-primary hover:text-on-primary sm:grid"
            aria-label="Next games"
          >
            ›
          </button>
        </>
      ) : null}
      <ul
        ref={scroller}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {games.map((game) => (
          <li
            key={game.game_id}
            className="w-44 shrink-0 snap-start sm:w-48"
          >
            <GameTile game={game} />
          </li>
        ))}
      </ul>
    </div>
  );
}
