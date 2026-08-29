import { formatMoney } from "@/lib/currency";
import {
  feePercent,
  processorLabel,
  roundMoney,
  splitEntry,
  sponsorDeposit,
} from "@/lib/fees";
import type { Currency } from "@/lib/schemas/common";
import { maxNetPot } from "@/lib/prizeBoard";

/**
 * The same numbers read very differently depending on who is looking.
 *
 * A player at checkout only needs to know what their team pays and what the
 * team can win. The platform's cut is our business arrangement with the host,
 * not a line item on their receipt.
 *
 * A host setting the event up needs the whole picture: the fee, and what is
 * left for them once the prize board is paid.
 */
type Audience = "host" | "player";

export function FeeSummary({
  kind,
  currency,
  entryFee = 0,
  prizeTotal = 0,
  feeBps,
  audience = "host",
  teamCount = 0,
}: {
  kind: "PAID" | "SPONSORED";
  currency: Currency;
  entryFee?: number;
  prizeTotal?: number;
  feeBps?: number;
  audience?: Audience;
  /** Used to project a full house for the host's take-home estimate. */
  teamCount?: number;
}) {
  const pct = feePercent(feeBps);
  const processor = processorLabel(currency);
  const entry = splitEntry(entryFee, feeBps);
  const deposit = sponsorDeposit(prizeTotal, feeBps);

  if (kind === "PAID" && audience === "player") {
    return (
      <div className="rounded-2xl border border-primary/35 bg-primary/10 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Entry fee
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-body">
          <li>
            {entryFee > 0 ? (
              <>
                Your team pays{" "}
                <span className="font-semibold text-white">
                  {formatMoney(entry.gross, currency)}
                </span>{" "}
                once, at checkout ({processor}). We do not convert currencies.
              </>
            ) : (
              <>One charge per team at checkout ({processor}).</>
            )}
          </li>
          <li>
            You pay for the whole team. Teammates you invite afterwards join
            free, and are never asked to pay.
          </li>
          <li>
            Entry fees fund the prize board. If your team places, the prize is
            transferred to you as captain.
          </li>
        </ul>
      </div>
    );
  }

  // Host view: full economics, including what they keep.
  const potCeiling = maxNetPot(entryFee, teamCount, feeBps);
  const hostTakeHome = roundMoney(Math.max(potCeiling - prizeTotal, 0));

  return (
    <div className="rounded-2xl border border-primary/35 bg-primary/10 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        Platform fee · {pct}%
      </p>
      {kind === "PAID" ? (
        <ul className="mt-3 space-y-1.5 text-sm text-body">
          <li>
            The entry fee is charged once per team, at checkout ({processor},{" "}
            {currency}). We do not convert currencies.
          </li>
          {entryFee > 0 ? (
            <>
              <li>
                Per team: {formatMoney(entry.gross, currency)} paid →{" "}
                {formatMoney(entry.net, currency)} to the pot →{" "}
                {formatMoney(entry.fee, currency)} to Gamelyd.
              </li>
              {teamCount > 0 ? (
                <li>
                  A full {teamCount} teams raises{" "}
                  {formatMoney(potCeiling, currency)} after the fee.
                  {prizeTotal > 0 ? (
                    <>
                      {" "}
                      Your prize board takes{" "}
                      {formatMoney(prizeTotal, currency)}, leaving{" "}
                      <span className="font-semibold text-white">
                        {formatMoney(hostTakeHome, currency)} for you
                      </span>
                      .
                    </>
                  ) : (
                    <> Whatever the prize board does not use is yours.</>
                  )}
                </li>
              ) : null}
              <li>
                Money is held until the event ends. Winners are paid first, then
                the remainder is transferred to you.
              </li>
            </>
          ) : (
            <li>
              Example: a {formatMoney(10, currency)} entry puts{" "}
              {formatMoney(splitEntry(10, feeBps).net, currency)} in the pot and{" "}
              {formatMoney(splitEntry(10, feeBps).fee, currency)} as the {pct}%
              fee. One charge per team, not per player. Set an entry fee to see
              exact numbers.
            </li>
          )}
        </ul>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-body">
          <li>
            You deposit the prize board plus {pct}% so winners receive the
            amounts you publish. Checkout is {processor} in {currency}. We do
            not convert.
          </li>
          {prizeTotal > 0 ? (
            <>
              <li>
                Winners&apos; board: {formatMoney(deposit.prizes, currency)}.
                Gamelyd fee: {formatMoney(deposit.fee, currency)}. You pay{" "}
                {formatMoney(deposit.gross, currency)} now.
              </li>
              <li>
                The event stays off the public list until that deposit clears.
                We hold the purse until the event ends, then pay each place to
                that team&apos;s captain.
              </li>
            </>
          ) : (
            <li>
              Example: a {formatMoney(100, currency)} board costs you{" "}
              {formatMoney(sponsorDeposit(100, feeBps).gross, currency)} to fund
              ({formatMoney(sponsorDeposit(100, feeBps).fee, currency)} fee).
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
