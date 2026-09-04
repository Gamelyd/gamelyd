import { CatalogImage } from "@/components/ui/CatalogImage";
import type { GroupQualifier } from "@/lib/schemas/tournament";
import type { LeagueStanding } from "@/lib/leagueStandings";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import { isSoloVerified, VerifiedName } from "@/components/ui/VerifiedName";
import {
  asDisqualifiedSet,
  qualifierForTeam,
  resolvedQualifyingNames,
} from "@/lib/groupQualifiers";
import { scoreColumnLabels } from "@/lib/catalog";

export type GroupStandingSection = {
  name: string;
  standings: LeagueStanding[];
};

export function GroupStandings({
  sections,
  advancePerGroup,
  qualifiers = [],
  manualSelection = false,
  disqualifiedTeams = [],
  scoreLabel = "Goals",
  allowDraw = true,
  onViewFixtures,
}: {
  sections: GroupStandingSection[];
  advancePerGroup: number;
  qualifiers?: GroupQualifier[];
  manualSelection?: boolean;
  disqualifiedTeams?: string[];
  scoreLabel?: "Goals" | "Points";
  allowDraw?: boolean;
  /** When set, each group shows a button jumping to its fixtures. */
  onViewFixtures?: (groupName: string) => void;
}) {
  if (sections.length === 0) {
    return (
      <p className="py-16 text-center text-body">No groups to show yet</p>
    );
  }

  const hasPicks = qualifiers.length > 0;
  const caption = manualSelection
    ? hasPicks
      ? "Highlighted teams qualify. A public reason is shown where the organiser broke a points tie."
      : ""
    : `Top ${advancePerGroup} of each group qualify for the knockout stage.`;

  return (
    <div className="space-y-3 py-2">
      {caption ? (
        <p className="text-center text-xs text-body">
          {caption}{" "}
          <span className="mx-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" />
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <GroupTable
            key={section.name}
            section={section}
            advancePerGroup={advancePerGroup}
            qualifiers={qualifiers}
            manualSelection={manualSelection}
            disqualifiedTeams={disqualifiedTeams}
            scoreLabel={scoreLabel}
            allowDraw={allowDraw}
            onViewFixtures={onViewFixtures}
          />
        ))}
      </div>
    </div>
  );
}

function GroupTable({
  section,
  advancePerGroup,
  qualifiers,
  manualSelection,
  disqualifiedTeams,
  scoreLabel,
  allowDraw,
  onViewFixtures,
}: {
  section: GroupStandingSection;
  advancePerGroup: number;
  qualifiers: GroupQualifier[];
  manualSelection: boolean;
  disqualifiedTeams: string[];
  scoreLabel: "Goals" | "Points";
  allowDraw: boolean;
  onViewFixtures?: (groupName: string) => void;
}) {
  const dq = asDisqualifiedSet(disqualifiedTeams);
  const through = new Set(
    resolvedQualifyingNames(
      section.standings,
      section.name,
      advancePerGroup,
      qualifiers,
      dq,
      manualSelection,
    ),
  );
  const cols = scoreColumnLabels(scoreLabel);

  return (
    <section className="overflow-hidden rounded-2xl border border-surface-2 bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-surface-2 bg-primary-panel px-4 py-3">
        <h3 className="font-display text-lg leading-tight text-white">
          {section.name}
        </h3>
        {onViewFixtures ? (
          <button
            type="button"
            onClick={() => onViewFixtures(section.name)}
            className="shrink-0 cursor-pointer rounded-lg border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-on-primary"
          >
            View fixtures
          </button>
        ) : null}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-105 text-left text-sm">
          <thead>
            <tr className="border-b border-surface-2 text-xs uppercase tracking-wide text-body">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Team</th>
              <th className="px-2 py-2.5 text-center font-medium">P</th>
              <th className="px-2 py-2.5 text-center font-medium">W</th>
              {allowDraw ? (
                <th className="px-2 py-2.5 text-center font-medium">D</th>
              ) : null}
              <th className="px-2 py-2.5 text-center font-medium">L</th>
              <th className="px-2 py-2.5 text-center font-medium">{cols.diff}</th>
              <th className="px-3 py-2.5 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {section.standings.map((row, index) => {
              const out = dq.has(row.TeamName);
              const pick = qualifierForTeam(
                qualifiers,
                section.name,
                row.TeamName,
              );
              const qualifies = !out && through.has(row.TeamName);
              const gd =
                row.GoalDifference > 0
                  ? `+${row.GoalDifference}`
                  : `${row.GoalDifference}`;
              return (
                <tr
                  key={row.TeamName}
                  className={`border-b border-surface-2 last:border-0 ${
                    out
                      ? "opacity-50"
                      : qualifies
                        ? "bg-primary/5"
                        : ""
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
                      <CatalogImage
                        src={resolveIcon(row.Icon, FALLBACKS.team)}
                        alt=""
                        width={24}
                        height={24}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <span className="truncate font-medium text-white">
                          <VerifiedName
                            name={row.TeamName}
                            verified={isSoloVerified(row.Players)}
                          />
                          {out ? (
                            <span className="ml-2 text-xs font-normal text-lose">
                              Disqualified
                            </span>
                          ) : null}
                        </span>
                        {pick ? (
                          <p className="mt-0.5 text-xs text-body">
                            {pick.Reason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Played}
                  </td>
                  <td className="px-2 py-2.5 text-center text-body">
                    {row.Won}
                  </td>
                  {allowDraw ? (
                    <td className="px-2 py-2.5 text-center text-body">
                      {row.Drawn}
                    </td>
                  ) : null}
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
