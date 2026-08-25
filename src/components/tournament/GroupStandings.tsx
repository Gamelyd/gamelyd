import Image from "next/image";
import type { LeagueStanding } from "@/lib/leagueStandings";
import { FALLBACKS, resolveIcon } from "@/lib/icons";

export type GroupStandingSection = {
  name: string;
  standings: LeagueStanding[];
};

export function GroupStandings({
  sections,
  advancePerGroup,
}: {
  sections: GroupStandingSection[];
  advancePerGroup: number;
}) {
  if (sections.length === 0) {
    return (
      <p className="py-16 text-center text-body">No groups to show yet</p>
    );
  }

  return (
    <div className="space-y-3 py-2">
      <p className="text-center text-xs text-body">
        Top {advancePerGroup} of each group{" "}
        <span className="mx-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" />{" "}
        qualify for the knockout stage.
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <GroupTable
            key={section.name}
            section={section}
            advancePerGroup={advancePerGroup}
          />
        ))}
      </div>
    </div>
  );
}

function GroupTable({
  section,
  advancePerGroup,
}: {
  section: GroupStandingSection;
  advancePerGroup: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-surface-2 bg-surface">
      <header className="border-b border-surface-2 bg-primary-panel px-4 py-3">
        <h3 className="font-display text-lg leading-tight text-white">
          {section.name}
        </h3>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-105 text-left text-sm">
          <thead>
            <tr className="border-b border-surface-2 text-xs uppercase tracking-wide text-body">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Team</th>
              <th className="px-2 py-2.5 text-center font-medium">P</th>
              <th className="px-2 py-2.5 text-center font-medium">W</th>
              <th className="px-2 py-2.5 text-center font-medium">D</th>
              <th className="px-2 py-2.5 text-center font-medium">L</th>
              <th className="px-2 py-2.5 text-center font-medium">GD</th>
              <th className="px-3 py-2.5 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {section.standings.map((row, index) => {
              const qualifies = index < advancePerGroup;
              const gd =
                row.GoalDifference > 0
                  ? `+${row.GoalDifference}`
                  : `${row.GoalDifference}`;
              return (
                <tr
                  key={row.TeamName}
                  className={`border-b border-surface-2 last:border-0 ${
                    qualifies ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        qualifies
                          ? "bg-primary text-primary-panel"
                          : "text-body"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Image
                        src={resolveIcon(row.Icon, FALLBACKS.team)}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                      <span className="truncate font-medium text-white">
                        {row.TeamName}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Played}
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Won}
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Drawn}
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Lost}
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">{gd}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-white">
                    {row.Points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
