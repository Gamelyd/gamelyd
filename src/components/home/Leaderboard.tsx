import Image from "next/image";
import { FALLBACKS } from "@/lib/icons";

interface LeaderEntry {
  num: string;
  color: string;
  rgb: string;
  size: "big" | "small";
}

const leaders: LeaderEntry[] = [
  { num: "2", color: "#D01966", rgb: "190, 25, 95, 0.50", size: "small" },
  { num: "1", color: "#d0be19", rgb: "190, 174, 25, 0.5", size: "big" },
  { num: "3", color: "#1DD019", rgb: "29, 190, 25, 0.50", size: "small" },
];

function ProfileCard({ entry }: { entry: LeaderEntry }) {
  const big = entry.size === "big";
  const dim = big ? 314 : 200;
  const numDim = big ? 60 : 40;
  return (
    <div className="relative mx-5 flex flex-col items-center max-[800px]:mx-2.5">
      <div
        className="relative rounded-full bg-surface-4 bg-cover bg-center bg-no-repeat max-[800px]:!h-[var(--sm)] max-[800px]:!w-[var(--sm)]"
        style={
          {
            width: dim,
            height: dim,
            border: `${big ? 9.2 : 5}px solid ${entry.color}`,
            boxShadow: `0px 5px 77px 1px rgba(${entry.rgb})`,
            "--sm": big ? "214px" : "100px",
          } as React.CSSProperties
        }
      >
        <Image
          src={FALLBACKS.player}
          alt="player"
          fill
          className="rounded-full object-cover"
        />
        <div
          className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full font-display text-black"
          style={{
            width: numDim,
            height: numDim,
            backgroundColor: entry.color,
            fontSize: big ? 40 : 20,
            bottom: big ? -30 : -20,
          }}
        >
          {entry.num}
        </div>
      </div>
      <div
        className="mt-8 text-center font-display text-white"
        style={{ fontSize: big ? 40 : 25 }}
      >
        Coming Soon
      </div>
    </div>
  );
}

export function Leaderboard() {
  return (
    <section className="bg-[linear-gradient(180deg,#101014_41.42%,#1f262f_163.4%)] pb-[50px]">
      <div className="flex flex-wrap items-center justify-center">
        <h2 className="mt-10 text-center font-display text-[50px] capitalize leading-[93%] text-white max-[700px]:text-[30px]">
          LEADERBOARD
        </h2>
        <div className="ml-10 mt-10 flex flex-row">
          <div className="flex h-[33px] w-[33px] items-center justify-center rounded-[3px] bg-primary">
            <Image src="/icons/filter.svg" alt="filter" width={18} height={18} />
          </div>
        </div>
      </div>
      <div className="my-[70px] flex flex-row items-center justify-center">
        {leaders.map((l) => (
          <ProfileCard key={l.num} entry={l} />
        ))}
      </div>
    </section>
  );
}
