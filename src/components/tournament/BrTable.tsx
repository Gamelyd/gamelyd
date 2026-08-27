import type { BrStanding } from "@/lib/brStandings";

export function BrTable({ standings }: { standings: BrStanding[] }) {
  if (standings.length === 0) {
    return (
      <p className="py-16 text-center text-body">No battle royale results yet</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-2 bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-2 text-xs uppercase tracking-wide text-body">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Team</th>
            <th className="px-3 py-3 text-center font-medium">Place pts</th>
            <th className="px-3 py-3 text-center font-medium">Kills</th>
            <th className="px-3 py-3 text-center font-medium">Kill pts</th>
            <th className="px-3 py-3 text-center font-medium">FB</th>
            <th className="px-4 py-3 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr
              key={row.TeamName}
              className="border-b border-surface-2 last:border-0"
            >
              <td className="px-4 py-3 font-medium text-white">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-white">{row.TeamName}</td>
              <td className="px-3 py-3 text-center text-body">
                {row.PlacementPoints}
              </td>
              <td className="px-3 py-3 text-center text-body">{row.Kills}</td>
              <td className="px-3 py-3 text-center text-body">{row.KillPoints}</td>
              <td className="px-3 py-3 text-center text-body">
                {row.FirstBloods}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-white">
                {row.Points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
