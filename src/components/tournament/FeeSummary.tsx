import { formatMoney } from "@/lib/currency";
import {
  feePercent,
  processorLabel,
  splitEntry,
  sponsorDeposit,
} from "@/lib/fees";
import type { Currency } from "@/lib/schemas/common";

export function FeeSummary({
  kind,
  currency,
  entryFee = 0,
  prizeTotal = 0,
  feeBps,
}: {
  kind: "PAID" | "SPONSORED";
  currency: Currency;
  entryFee?: number;
  prizeTotal?: number;
  feeBps?: number;
}) {
  const pct = feePercent(feeBps);
  const processor = processorLabel(currency);
  const entry = splitEntry(entryFee, feeBps);
  const deposit = sponsorDeposit(prizeTotal, feeBps);

  return (
    <div className="rounded-2xl border border-primary/35 bg-primary/10 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        Platform fee · {pct}%
      </p>
      {kind === "PAID" ? (
        <ul className="mt-3 space-y-1.5 text-sm text-body">
          <li>
            Players pay the entry fee at checkout ({processor}, {currency}
            ). We do not convert currencies.
          </li>
          {entryFee > 0 ? (
            <>
              <li>
                Each seat: {formatMoney(entry.gross, currency)} paid →{" "}
                {formatMoney(entry.net, currency)} to the pot →{" "}
                {formatMoney(entry.fee, currency)} to Gamelyd.
              </li>
              <li>
                Money stays held until the tournament ends. We then record
                what is owed from the net pot - bank transfers are a later
                step.
              </li>
            </>
          ) : (
            <li>
              Example: a {formatMoney(10, currency)} entry puts{" "}
              {formatMoney(splitEntry(10, feeBps).net, currency)} in the pot and{" "}
              {formatMoney(splitEntry(10, feeBps).fee, currency)} as the {pct}%
              fee.
              Set an entry fee to see exact numbers.
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
                We hold the purse until the event ends, then record what is
                owed.
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
