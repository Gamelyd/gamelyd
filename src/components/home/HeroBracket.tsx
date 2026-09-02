type Seat = { name: string; score: number; through?: boolean };

/*
 * An illustration of the bracket view, not live data - the names are
 * deliberately generic so nobody reads it as a real event.
 */
const SEMIS: [Seat, Seat][] = [
  [
    { name: "Night Owls", score: 3, through: true },
    { name: "Red Shift", score: 1 },
  ],
  [
    { name: "Palm City", score: 0 },
    { name: "Vanta FC", score: 2, through: true },
  ],
];

const FINAL: [Seat, Seat] = [
  { name: "Night Owls", score: 1 },
  { name: "Vanta FC", score: 4, through: true },
];

function SeatRow({ seat }: { seat: Seat }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${
        seat.through ? "text-white" : "text-white/45"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            seat.through ? "bg-primary" : "bg-white/20"
          }`}
        />
        <span className="truncate">{seat.name}</span>
      </span>
      <span
        className={`shrink-0 font-display text-base leading-none ${
          seat.through ? "text-primary" : "text-white/40"
        }`}
      >
        {seat.score}
      </span>
    </div>
  );
}

function Match({ seats }: { seats: [Seat, Seat] }) {
  return (
    <div className="divide-y divide-white/8 overflow-hidden rounded-lg border border-white/10 bg-black/30">
      <SeatRow seat={seats[0]} />
      <SeatRow seat={seats[1]} />
    </div>
  );
}

export function HeroBracket() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-primary-panel">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-display text-lg leading-none text-white">
          Bracket view
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 p-4">
        <div className="grid gap-4">
          <Match seats={SEMIS[0]} />
          <Match seats={SEMIS[1]} />
        </div>

        {/* Connector: two arms folding into the final. */}
        <div
          className="h-16 w-4 border-y border-r border-white/15"
          aria-hidden
        />

        <div className="grid gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
            Final
          </p>
          <Match seats={FINAL} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Champion
        </span>
        <span className="truncate font-display text-lg leading-none text-secondary">
          Vanta FC
        </span>
      </div>
    </div>
  );
}
