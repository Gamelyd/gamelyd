import Image from "next/image";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Tag } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);

  return (
    <Link
      href={`/tournament/${tournament.TournamentId}`}
      className="group relative block aspect-[225/309] w-full overflow-hidden rounded-[22px] bg-surface-4"
    >
      <Image
        src={image}
        alt={tournament.Name}
        fill
        sizes="(max-width: 768px) 50vw, 225px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />

      <div className="absolute left-3 top-3">
        <Tag payment={tournament.Payment} className="rounded-md" />
      </div>

      {tournament.OrgId && tournament.OrgName && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-primary">
          {tournament.OrgIcon && (
            <Image
              src={tournament.OrgIcon}
              alt={tournament.OrgName}
              width={14}
              height={14}
              className="rounded-full object-cover"
            />
          )}
          <span className="max-w-[90px] truncate">{tournament.OrgName}</span>
        </div>
      )}

      <div className="absolute bottom-0 flex min-h-[71px] w-full flex-col justify-center rounded-b-[22px] bg-black/80 px-3 py-2">
        <span className="line-clamp-1 font-display text-[20px] leading-tight text-white">
          {tournament.Name}
        </span>
        <span className="line-clamp-1 font-body text-xs text-body">
          {tournament.GameName}
        </span>
      </div>
    </Link>
  );
}

export function EmptyTournaments({
  message = "No tournaments yet",
}: {
  message?: string;
}) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-surface-2 bg-surface/50 py-16 text-center text-body">
      {message}
    </div>
  );
}
