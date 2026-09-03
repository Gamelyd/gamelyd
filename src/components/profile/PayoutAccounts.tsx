"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Loader } from "@/components/ui/Loader";
import { Confirm } from "@/components/ui/Confirm";
import { CollapsiblePanel } from "@/components/ui/CollapsiblePanel";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { processorForCurrency } from "@/lib/fees";
import type { Currency } from "@/lib/schemas/common";
import type {
  BankOption,
  PayoutAccount,
} from "@/lib/schemas/payment";
import {
  connectBankAccountAction,
  listBanksAction,
  myPayoutAccountsAction,
  refreshStripePayoutAccountAction,
  removePayoutAccountAction,
  startStripePayoutOnboardingAction,
} from "@/server/actions/payoutActions";

/**
 * Where a player connects the account their prize money lands in. Paid events
 * require this before the captain can register, because the captain is who the
 * team's winnings are sent to.
 */
export function PayoutAccounts() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [bankError, setBankError] = useState("");
  const [banksReload, setBanksReload] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<PayoutAccount | null>(null);

  const processor = processorForCurrency(currency);

  const load = useCallback(async () => {
    const accountResult = await myPayoutAccountsAction();
    if (accountResult.ok) setAccounts(accountResult.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Stripe onboarding finishes on Stripe's site, so re-check on return.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("stripe") === "done"
    ) {
      void refreshStripePayoutAccountAction().then(() => void load());
    }
  }, [load]);

  // Only Paystack currencies have a bank list; the Stripe branch renders a
  // button instead, so `bankOptions` derives emptiness rather than resetting
  // state from inside the effect.
  useEffect(() => {
    if (processor !== "PAYSTACK") return;
    let active = true;
    setLoadingBanks(true);
    setBankError("");
    void listBanksAction(currency).then((result) => {
      if (!active) return;
      if (result.ok) {
        setBanks(result.data);
        // An empty list is a failure the user must be able to see, not an
        // empty dropdown they are left guessing at.
        if (result.data.length === 0) {
          setBankError(`No banks came back for ${currency}. Try again.`);
        }
      } else {
        setBankError(result.error);
      }
      setLoadingBanks(false);
    });
    return () => {
      active = false;
    };
  }, [currency, processor, banksReload]);

  const bankOptions = processor === "PAYSTACK" ? banks : [];

  const connectBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await connectBankAccountAction({
      currency,
      bank_code: bankCode,
      account_number: accountNumber,
    });
    setSaving(false);
    if (result.ok) {
      toast.success(result.message ?? "Payout account connected");
      setAccountNumber("");
      setBankCode("");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  const startStripe = async () => {
    setSaving(true);
    const result = await startStripePayoutOnboardingAction();
    setSaving(false);
    if (result.ok) {
      window.location.href = result.data.url;
      return;
    }
    toast.error(result.error);
  };

  const remove = async () => {
    if (!removeTarget) return;
    setSaving(true);
    const result = await removePayoutAccountAction(removeTarget.currency);
    setSaving(false);
    setRemoveTarget(null);
    if (result.ok) {
      toast.success(result.message ?? "Removed");
      void load();
    } else {
      toast.error(result.error);
    }
  };

  if (loading) return <Loader label="Loading payout details" />;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-surface-2 bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
          Payout accounts
        </h3>
        <p className="mt-1 text-sm text-body">
          Prize money is paid to the team captain. Connect an account before you
          register for a paid tournament.
        </p>

        {accounts.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li
                key={account.account_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-2 bg-surface-2/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {account.processor === "STRIPE"
                      ? "Stripe · USD / GBP / EUR"
                      : `${account.bank_name || "Bank"} · ••••${account.account_last4}`}
                  </p>
                  <p className="text-xs text-body">
                    {account.account_name || "Pending verification"}
                    {account.detail ? ` · ${account.detail}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${
                      account.status === "VERIFIED"
                        ? "bg-win-deep text-white"
                        : account.status === "FAILED"
                          ? "bg-lose/15 text-lose"
                          : "bg-yellow/15 text-yellow"
                    }`}
                  >
                    {account.status}
                  </span>
                  {account.processor === "STRIPE" &&
                  account.status !== "VERIFIED" ? (
                    <Button variant="outline" onClick={() => void startStripe()}>
                      Finish setup
                    </Button>
                  ) : null}
                  <Button
                    variant="dark"
                    onClick={() => setRemoveTarget(account)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-surface-2 px-4 py-6 text-center text-sm text-body">
            No payout account yet.
          </p>
        )}
      </div>

      <CollapsiblePanel
        title="Add an account"
        description="Pick the currency you play in. We never store your full account number."
        /* Open straight away when there is nothing to be paid into, since that
           is the one thing the page is asking the player to do. */
        defaultOpen={accounts.length === 0}
        scroll={false}
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Currency"
            value={currency}
            options={CURRENCY_OPTIONS}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          />

          {processor === "PAYSTACK" ? (
            <form onSubmit={connectBank} className="flex flex-col gap-4">
              {bankError ? (
                <div className="rounded-lg border border-lose/40 bg-lose/10 p-4">
                  <p className="text-sm text-white">{bankError}</p>
                  <Button
                    type="button"
                    variant="dark"
                    className="mt-3"
                    onClick={() => setBanksReload((n) => n + 1)}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
              <Select
                label={
                  bankOptions.length > 0
                    ? `Bank (${bankOptions.length})`
                    : "Bank"
                }
                value={bankCode}
                disabled={loadingBanks || bankOptions.length === 0}
                options={[
                  {
                    value: "",
                    label: loadingBanks
                      ? "Loading banks…"
                      : bankOptions.length === 0
                        ? "No banks available"
                        : "Select your bank",
                  },
                  ...bankOptions.map((bank) => ({
                    value: bank.code,
                    label: bank.name,
                  })),
                ]}
                onChange={(e) => setBankCode(e.target.value)}
              />
              <Input
                label="Account number"
                value={accountNumber}
                inputMode="numeric"
                onChange={(e) =>
                  setAccountNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="0123456789"
              />
              <Button
                type="submit"
                loading={saving}
                disabled={!bankCode || accountNumber.length < 8}
              >
                Verify and connect
              </Button>
            </form>
          ) : (
            <div>
              <p className="mb-4 text-sm text-body">
                {currency} payouts run through Stripe. Stripe collects and
                verifies your bank details on their own secure page.
              </p>
              <Button loading={saving} onClick={() => void startStripe()}>
                Connect with Stripe
              </Button>
            </div>
          )}
        </div>
      </CollapsiblePanel>

      <Confirm
        open={removeTarget !== null}
        title="Remove this payout account?"
        message="You will not be able to register for paid tournaments until you add another one."
        confirmLabel="Remove"
        loading={saving}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!saving) setRemoveTarget(null);
        }}
      />
    </div>
  );
}
