"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/currency";
import { placeLabel } from "@/lib/schemas/tournament";
import type { Currency } from "@/lib/schemas/common";
import type { PayoutRecord, PayoutStatus } from "@/lib/schemas/payment";
import { myPayoutsAction } from "@/server/actions/payoutActions";

/** Plain words for the ledger states, so the table reads without a glossary. */
const STATUS: Record<
  PayoutStatus,
  { label: string; chip: string; hint: string }
> = {
  OWED: {
    label: "Pending",
    chip: "bg-yellow/15 text-yellow",
    hint: "Recorded and waiting to be sent.",
  },
  PROCESSING: {
    label: "Sending",
    chip: "bg-primary/15 text-primary",
    hint: "The transfer is with the payment company.",
  },
  PAID: {
    label: "Paid",
    chip: "bg-win-deep text-white",
    hint: "Sent to your payout account.",
  },
  FAILED: {
    label: "Failed",
    chip: "bg-lose/15 text-lose",
    // Deliberately no processor detail here: those messages are often about
    // the platform's own payment account, not the player's, and showing them
    // would send people to fix something that is not theirs to fix.
    hint: "The transfer did not go through. We will look into it and try again.",
  },
};

interface CurrencyTotals {
  currency: Currency;
  paid: number;
  pending: number;
  failed: number;
}

function formatDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Everything the platform owes or has sent this player, in one place.
 *
 * Totals are grouped by currency rather than summed: an event in NGN and one in
 * USD cannot be added together, and a single blended number would be wrong.
 */
export function Earnings() {
  const toast = useToast();
  const [rows, setRows] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void myPayoutsAction().then((result) => {
      if (!active) return;
      if (result.ok) setRows(result.data);
      else toast.error(result.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [toast]);

  const totals = useMemo<CurrencyTotals[]>(() => {
    const byCurrency = new Map<Currency, CurrencyTotals>();
    for (const row of rows) {
      const entry = byCurrency.get(row.currency) ?? {
        currency: row.currency,
        paid: 0,
        pending: 0,
        failed: 0,
      };
      if (row.status === "PAID") entry.paid += row.amount;
      else if (row.status === "FAILED") entry.failed += row.amount;
      else entry.pending += row.amount;
      byCurrency.set(row.currency, entry);
    }
    return [...byCurrency.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );
  }, [rows]);

  if (loading) return <Loader label="Loading earnings" />;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-surface-2 bg-surface p-8 text-center">
        <h3 className="font-display text-lg text-white">No earnings yet</h3>
        <p className="mt-1 text-sm text-body">
          Win a paid or sponsored tournament as team captain and your prize
          money shows up here, with its status at every step.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {totals.map((total) => (
          <div
            key={total.currency}
            className="rounded-xl border border-surface-2 bg-surface p-5"
          >
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-body">
              {total.currency}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="font-display text-2xl leading-none text-win">
                  {formatMoney(total.paid, total.currency)}
                </p>
                <p className="mt-1 text-xs text-body">Paid to you</p>
              </div>
              <div>
                <p className="font-display text-2xl leading-none text-yellow">
                  {formatMoney(total.pending, total.currency)}
                </p>
                <p className="mt-1 text-xs text-body">Pending</p>
              </div>
              <div>
                <p
                  className={`font-display text-2xl leading-none ${
                    total.failed > 0 ? "text-lose" : "text-body"
                  }`}
                >
                  {formatMoney(total.failed, total.currency)}
                </p>
                <p className="mt-1 text-xs text-body">Needs attention</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-2">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="bg-surface-2 text-body">
            <tr>
              <th className="px-4 py-3 font-medium">Tournament</th>
              <th className="px-4 py-3 font-medium">For</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = STATUS[row.status];
              return (
                <tr key={row.payout_id} className="border-t border-surface-2">
                  <td className="px-4 py-3">
                    <Link
                      href={`/tournament/${row.tournamentId}`}
                      className="text-white hover:text-primary"
                    >
                      {row.tournamentName || "Tournament"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-body">
                    {row.place > 0
                      ? `${placeLabel(row.place)} place`
                      : "Host remainder"}
                    {row.teamName && row.place > 0 ? (
                      <span className="block text-xs">{row.teamName}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${status.chip}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body tabular-nums">
                    {formatDate(row.paid_at || row.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
          What the statuses mean
        </h3>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          {(Object.keys(STATUS) as PayoutStatus[]).map((key) => (
            <div key={key} className="flex flex-wrap items-baseline gap-2">
              <dt
                className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[key].chip}`}
              >
                {STATUS[key].label}
              </dt>
              <dd className="text-body">{STATUS[key].hint}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-body">
          Prize money is paid to the team captain. If a payout is pending for
          longer than you expect, check that your payout account above is
          connected and verified, then contact us if it still has not moved.
        </p>
      </div>
    </div>
  );
}
