import { SectionHead } from "@/components/home/HomeContent";
import { Reveal } from "@/components/ui/Reveal";

export function Leaderboard() {
  const rows = [1, 2, 3];

  return (
    <section className="border-t border-primary/20">
      <div className="mx-auto max-w-page px-page py-16">
        <Reveal>
          <SectionHead
            kicker="Rankings"
            title="Leaderboard"
            description="Season standings are not live yet. Rankings will fill from scored tournament results."
          />

          <div className="mt-8 overflow-hidden rounded-2xl border border-primary/25 bg-primary-panel">
            <table className="w-full text-left">
              <thead className="bg-black/25 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                <tr>
                  <th className="w-20 px-5 py-3">Rank</th>
                  <th className="px-5 py-3">Player</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((rank) => (
                  <tr key={rank} className="border-t border-primary/15">
                    <td className="px-5 py-4 font-display text-xl text-primary">
                      {rank}
                    </td>
                    <td className="px-5 py-4 text-white/40">-</td>
                    <td className="px-5 py-4 text-right text-sm uppercase tracking-wider text-primary/70">
                      Standby
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
