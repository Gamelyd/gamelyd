export function Leaderboard() {
  const rows = [1, 2, 3];

  return (
    <section className="bg-bg">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Rankings
        </p>
        <h2 className="mt-1 font-display text-3xl text-white sm:text-4xl">
          Leaderboard
        </h2>
        <p className="mt-2 max-w-xl text-body">
          Season standings are not live yet. Rankings will fill from scored
          tournament results.
        </p>

        <div className="mt-8 overflow-hidden rounded-xl border border-surface-2">
          <table className="w-full text-left">
            <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              <tr>
                <th className="w-20 px-5 py-3">Rank</th>
                <th className="px-5 py-3">Player</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((rank) => (
                <tr
                  key={rank}
                  className="border-t border-surface-2 bg-surface"
                >
                  <td className="px-5 py-4 font-display text-xl text-primary">
                    {rank}
                  </td>
                  <td className="px-5 py-4 text-white/40">—</td>
                  <td className="px-5 py-4 text-right text-sm text-body">
                    Coming soon
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
