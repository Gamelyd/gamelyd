import Link from "next/link";
import type { Tournament } from "@/lib/schemas/tournament";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

function formatDate(date: string): string {
  if (!date) return "coming soon";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "coming soon";
  return parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function naira(amount: number): string {
  return "₦" + (amount || 0).toLocaleString();
}

function modeBadge(mode: Tournament["TournamentMode"]): string {
  if (mode === "LEAGUE") return "(LG)";
  if (mode === "BATTLEROYALE") return "(BR)";
  if (mode === "GROUPS") return "(GR)";
  return "(MP)";
}

export function TournamentDisplay({ tournament }: { tournament: Tournament }) {
  const image = resolveIcon(tournament.icon, FALLBACKS.tournament);
  const showPrize =
    tournament.Payment === "SPONSORED" || tournament.Payment === "PAID";

  return (
    <div
      className="flex h-[350px] w-[550px] min-w-[300px] max-w-[90vw] flex-col justify-between overflow-hidden bg-surface-4 bg-cover bg-center bg-no-repeat max-[700px]:h-[300px] max-[700px]:w-[85vw]"
      style={{ backgroundImage: `url("${image}")` }}
    >
      <div className="w-full">
        <div className="flex w-full items-center justify-between p-5">
          <div className="flex flex-col items-start">
            <Tag payment={tournament.Payment} />
            <div className="mt-2.5 inline-flex flex-col items-start bg-[#1f2833] p-[6.5px]">
              <span className="font-display text-[19px] leading-none text-white max-[700px]:text-[13px]">
                Entry Fee
              </span>
              <span className="font-display text-[2.6em] leading-[93%] text-primary max-[700px]:text-[1.5em]">
                {tournament.IsPaid ? naira(tournament.RegistrationAmount) : "₦0"}
              </span>
            </div>
          </div>

          {showPrize && (
            <div className="inline-flex flex-col items-end rounded-[5px] bg-[#1f2731] p-[5px]">
              <span className="font-display text-[1.9em] leading-[93%] text-white max-[700px]:text-[1.3em]">
                Prize
              </span>
              <span className="font-display text-[4.3em] leading-[93%] text-primary max-[700px]:text-[2.9em]">
                {naira(tournament.Amount)}
              </span>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col">
          <span className="inline-block bg-black p-2.5 font-body text-[21px] font-bold uppercase leading-[93%] text-yellow-soft max-[700px]:text-[16px]">
            {tournament.Name} ({tournament.GameName})
          </span>
          <span className="inline-block bg-black p-2.5 font-body text-[21px] font-bold uppercase leading-[93%] text-yellow-soft max-[700px]:text-[16px]">
            {tournament.Platform || "Cross Platform"}{" "}
            {modeBadge(tournament.TournamentMode)}
          </span>
        </div>
      </div>

      <div className="flex h-[82px] w-full items-center justify-between bg-black px-5">
        <div>
          <div className="font-body text-[17px] font-bold uppercase leading-tight text-white max-[700px]:text-[12px]">
            {formatDate(tournament.Date)}
          </div>
          <div className="font-body text-[17px] font-bold uppercase leading-tight text-yellow-soft max-[700px]:text-[12px]">
            winner takes all
          </div>
        </div>
        <Link href={`/tournament/${tournament.TournamentId}`}>
          <Button>ENTER TOURNAMENT</Button>
        </Link>
      </div>
    </div>
  );
}

export function EmptyTournamentDisplay() {
  return (
    <div
      className="flex h-[350px] w-[550px] min-w-[300px] max-w-[90vw] flex-col items-center justify-center gap-5 bg-surface-4 bg-cover bg-center bg-no-repeat p-8 text-center max-[700px]:h-[300px] max-[700px]:w-[85vw]"
      style={{ backgroundImage: `url("${FALLBACKS.tournament}")` }}
    >
      <div className="rounded bg-black/70 p-4">
        <p className="font-display text-2xl text-white">
          Contact us to sponsor a tournament
        </p>
      </div>
      <Link href="/contact-us">
        <Button>CONTACT US</Button>
      </Link>
    </div>
  );
}
