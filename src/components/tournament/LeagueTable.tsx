import { CatalogImage } from "@/components/ui/CatalogImage";
import type { LeagueStanding } from "@/lib/leagueStandings";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { isSoloVerified, VerifiedName } from "@/components/ui/VerifiedName";
import { scoreColumnLabels } from "@/lib/catalog";

export function LeagueTable({
  standings,
  scoreLabel = "Goals",
  allowDraw = true,
}: {
  standings: LeagueStanding[];
  scoreLabel?: "Goals" | "Points";
  allowDraw?: boolean;
}) {
  if (standings.length === 0) {
    return (
      <p className="py-16 text-center text-body">
        No teams registered yet
      </p>
    );
  }

  const cols = scoreColumnLabels(scoreLabel);

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-2 bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-2 text-xs uppercase tracking-wide text-body">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-3 py-3 text-center font-medium">P</th>
            <th className="px-3 py-3 text-center font-medium">W</th>
            {allowDraw ? (
              <th className="px-3 py-3 text-center font-medium">D</th>
            ) : null}
            <th className="px-3 py-3 text-center font-medium">L</th>
            <th className="px-3 py-3 text-center font-medium">{cols.for}</th>
            <th className="px-3 py-3 text-center font-medium">{cols.against}</th>
            <th className="px-3 py-3 text-center font-medium">{cols.diff}</th>
            <th className="px-4 py-3 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => {
            const icon = resolveIcon(row.Icon, FALLBACKS.team);
            const gd =
              row.GoalDifference > 0
                ? `+${row.GoalDifference}`
                : `${row.GoalDifference}`;
            return (
              <tr
                key={row.TeamName}
                className="border-b border-surface-2 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-white">{index + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CatalogImage
                      src={icon}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <VerifiedName
                      name={row.TeamName}
                      verified={isSoloVerified(row.Players)}
                      className="font-medium text-white"
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-center text-body">{row.Played}</td>
                <td className="px-3 py-3 text-center text-body">{row.Won}</td>
                {allowDraw ? (
                  <td className="px-3 py-3 text-center text-body">{row.Drawn}</td>
                ) : null}
                <td className="px-3 py-3 text-center text-body">{row.Lost}</td>
                <td className="px-3 py-3 text-center text-body">{row.GoalsFor}</td>
                <td className="px-3 py-3 text-center text-body">
                  {row.GoalsAgainst}
                </td>
                <td className="px-3 py-3 text-center text-body">{gd}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">
                  {row.Points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
