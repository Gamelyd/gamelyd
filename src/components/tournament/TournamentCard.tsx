import Image from "next/image";
import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Tag, paymentFrame } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);

  return (
    <Link
      href={`/tournament/${tournament.TournamentId}`}
      className={`group relative block aspect-225/309 w-full overflow-hidden rounded-xl bg-surface-4 ${paymentFrame(tournament.Payment)}`}
    >
      <Image
        src={image}
        alt={tournament.Name}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        quality={90}
        className="object-cover"
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

      <div className="absolute bottom-0 flex min-h-[71px] w-full flex-col justify-center bg-black px-3 py-2">
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
    <div className="col-span-full rounded-xl border border-white/15 bg-surface py-16 text-center text-body shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]">
      {message}
    </div>
  );
}
