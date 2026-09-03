"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { Loader } from "@/components/ui/Loader";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/currency";
import { Select } from "@/components/ui/Select";
import { PLAN_ORDER, type Plan } from "@/lib/plans";
import { PlanEditor } from "@/components/admin/PlanEditor";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { splitEntry, sponsorDeposit } from "@/lib/fees";
import {
  adminGetPlatformSettingsAction,
  adminSetEventTypeEnabledAction,
  adminSetOneOffAction,
  adminSetSponsorPolicyAction,
  adminSetRatingEnabledAction,
  adminSetPlatformFeeAction,
} from "@/server/actions/adminActions";

export default function AdminSettingsPage() {
  const toast = useToast();
  const [current, setCurrent] = useState<number | null>(null);
  const [paidEnabled, setPaidEnabled] = useState(true);
  const [sponsoredEnabled, setSponsoredEnabled] = useState(true);
  const [togglingType, setTogglingType] = useState("");
  const [oneOff, setOneOff] = useState({
    enabled: false,
    price: "",
    currency: "EUR",
    tier: "CLUB" as Plan,
  });
  const [savingOneOff, setSavingOneOff] = useState(false);
  const [sponsorRequiresOrg, setSponsorRequiresOrg] = useState(true);
  const [savingSponsor, setSavingSponsor] = useState(false);
  const [ratings, setRatings] = useState({
    user: true,
    org: true,
    tournament: true,
  });
  const [togglingRating, setTogglingRating] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    void adminGetPlatformSettingsAction().then((result) => {
      if (result.ok) {
        setCurrent(result.data.feeBps);
        setValue(String(result.data.feeBps / 100));
        setPaidEnabled(result.data.paidEnabled);
        setSponsoredEnabled(result.data.sponsoredEnabled);
        setOneOff({
          enabled: result.data.oneOffEnabled,
          price: String(result.data.oneOffPriceMinor / 100),
          currency: result.data.oneOffCurrency,
          tier: result.data.oneOffTier,
        });
        setSponsorRequiresOrg(result.data.sponsorRequiresOrg);
        setRatings({
          user: result.data.ratingUser,
          org: result.data.ratingOrg,
          tournament: result.data.ratingTournament,
        });
        setUpdatedAt(result.data.updated_at);
      } else {
        toast.error(result.error);
      }
    });
  }, [toast]);

  const percent = Number(value);
  const valid = Number.isFinite(percent) && percent >= 0 && percent <= 50;
  const changed = valid && current !== null && Math.round(percent * 100) !== current;
  // Preview against a round number so the effect of the rate is concrete.
  const sample = 10000;
  const entry = splitEntry(sample, Math.round(percent * 100));
  const deposit = sponsorDeposit(sample, Math.round(percent * 100));

  const save = async () => {
    setSaving(true);
    const result = await adminSetPlatformFeeAction(percent);
    setSaving(false);
    setConfirmOpen(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setCurrent(result.data.feeBps);
      setUpdatedAt(result.data.updated_at);
    } else {
      toast.error(result.error);
    }
  };

  const toggleType = async (which: "paid" | "sponsored", next: boolean) => {
    setTogglingType(which);
    const result = await adminSetEventTypeEnabledAction(which, next);
    setTogglingType("");
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setPaidEnabled(result.data.paidEnabled);
      setSponsoredEnabled(result.data.sponsoredEnabled);
    } else {
      toast.error(result.error);
    }
  };

  const saveOneOff = async () => {
    setSavingOneOff(true);
    const result = await adminSetOneOffAction({
      enabled: oneOff.enabled,
      price: Number(oneOff.price) || 0,
      currency: oneOff.currency,
      tier: oneOff.tier,
    });
    setSavingOneOff(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setOneOff((o) => ({
        ...o,
        enabled: result.data.oneOffEnabled,
        price: String(result.data.oneOffPriceMinor / 100),
      }));
    } else {
      toast.error(result.error);
    }
  };

  const saveSponsorPolicy = async (requiresOrg: boolean) => {
    setSavingSponsor(true);
    const result = await adminSetSponsorPolicyAction(requiresOrg);
    setSavingSponsor(false);
    if (result.ok) {
      toast.success(result.message ?? "Saved");
      setSponsorRequiresOrg(result.data.sponsorRequiresOrg);
    } else {
      toast.error(result.error);
    }
  };

  const toggleRating = async (
    kind: "USER" | "ORG" | "TOURNAMENT",
    next: boolean,
  ) => {
    setTogglingRating(kind);
    const result = await adminSetRatingEnabledAction(kind, next);
    setTogglingRating("");
    if (result.ok) {
      setRatings({
        user: result.data.ratingUser,
        org: result.data.ratingOrg,
        tournament: result.data.ratingTournament,
      });
      setUpdatedAt(result.data.updated_at);
      toast.success(result.message ?? "Saved");
    } else {
      toast.error(result.error);
    }
  };

  if (current === null) return <Loader label="Loading settings" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-white">Settings</h1>
        <p className="mt-1 text-sm text-body">
          Platform-wide configuration.
        </p>
      </div>

      <PlanEditor />

      <TemplateEditor />

      <div className="mb-6 max-w-2xl rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="font-semibold text-white">Tournament types</h2>
        <p className="mt-1 text-sm text-body">
          Both are off until you turn them on. While off, hosts see
          &ldquo;Coming back soon&rdquo; instead of being able to pick them.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <TypeToggle
            label="Paid tournaments"
            blurb="Players pay an entry fee that funds the prize board."
            enabled={paidEnabled}
            busy={togglingType === "paid"}
            onToggle={(next) => void toggleType("paid", next)}
          />
          <TypeToggle
            label="Sponsored tournaments"
            blurb="The host deposits the prize board up front."
            enabled={sponsoredEnabled}
            busy={togglingType === "sponsored"}
            onToggle={(next) => void toggleType("sponsored", next)}
          />
        </div>

        <div className="mt-4 rounded-xl border border-yellow/35 bg-yellow/10 p-4">
          <p className="text-sm text-white">
            Pausing only stops new tournaments.
          </p>
          <p className="mt-1 text-sm text-body">
            Events already running keep taking entries, paying out, and
            settling, so nobody is stranded mid-tournament.
          </p>
        </div>
      </div>

      <div className="mb-6 max-w-2xl rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="font-semibold text-white">Who can sponsor</h2>
        <p className="mt-1 text-sm text-body">
          Sponsored is a badge on a tournament, not a money feature. Choose who
          is allowed to create one.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-2 bg-surface-2/40 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {sponsorRequiresOrg ? "Organizations only" : "Anyone"}
            </p>
            <p className="text-xs text-body">
              {sponsorRequiresOrg
                ? "Only members hosting under an organization can create a sponsored event."
                : "Any signed-in host can create a sponsored event."}
            </p>
          </div>
          <Button
            variant="dark"
            loading={savingSponsor}
            onClick={() => void saveSponsorPolicy(!sponsorRequiresOrg)}
          >
            {sponsorRequiresOrg ? "Allow anyone" : "Restrict to orgs"}
          </Button>
        </div>
      </div>

      <div className="mb-6 max-w-2xl rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="font-semibold text-white">Ratings</h2>
        <p className="mt-1 text-sm text-body">
          Turn each rating surface on or off. Off hides it everywhere and stops
          new ratings for that type.
        </p>
        <div className="mt-4 grid gap-3">
          <TypeToggle
            label="Player ratings"
            blurb="Players can rate each other, shown on profiles."
            enabled={ratings.user}
            busy={togglingRating === "USER"}
            onToggle={(next) => void toggleRating("USER", next)}
          />
          <TypeToggle
            label="Organization ratings"
            blurb="Anyone can rate an organization on its page."
            enabled={ratings.org}
            busy={togglingRating === "ORG"}
            onToggle={(next) => void toggleRating("ORG", next)}
          />
          <TypeToggle
            label="Tournament ratings"
            blurb="Anyone can rate a tournament; cards show the score."
            enabled={ratings.tournament}
            busy={togglingRating === "TOURNAMENT"}
            onToggle={(next) => void toggleRating("TOURNAMENT", next)}
          />
        </div>
      </div>

      <div className="mb-6 max-w-2xl rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="font-semibold text-white">One-off tournaments</h2>
        <p className="mt-1 text-sm text-body">
          Let a host pay once to create a single event above the free limits,
          without subscribing. This is a fee to you, not prize money.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input
            type="number"
            min={0}
            step="0.01"
            label="Price"
            value={oneOff.price}
            onChange={(e) =>
              setOneOff((o) => ({ ...o, price: e.target.value }))
            }
          />
          <Select
            label="Currency"
            value={oneOff.currency}
            options={CURRENCY_OPTIONS}
            onChange={(e) =>
              setOneOff((o) => ({ ...o, currency: e.target.value }))
            }
          />
          <Select
            label="Unlocks the"
            value={oneOff.tier}
            options={PLAN_ORDER.map((plan) => ({
              value: plan,
              label: `${plan} limits`,
            }))}
            onChange={(e) =>
              setOneOff((o) => ({ ...o, tier: e.target.value as Plan }))
            }
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={oneOff.enabled}
            onChange={(e) =>
              setOneOff((o) => ({ ...o, enabled: e.target.checked }))
            }
            className="h-4 w-4 accent-primary"
          />
          Offer one-off tournaments to hosts
        </label>

        <div className="mt-4">
          <Button loading={savingOneOff} onClick={() => void saveOneOff()}>
            Save one-off pricing
          </Button>
        </div>
      </div>

      <div className="max-w-2xl rounded-2xl border border-surface-2 bg-surface p-5">
        <h2 className="font-semibold text-white">Platform fee</h2>
        <p className="mt-1 text-sm text-body">
          What Gamelyd keeps from paid entries and sponsored deposits. Currently{" "}
          <span className="font-semibold text-white">{current / 100}%</span>
          {updatedAt
            ? ` · last changed ${new Date(updatedAt).toLocaleDateString()}`
            : " · never changed"}
          .
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              type="number"
              min={0}
              max={50}
              step="0.01"
              label="Fee (%)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button
            disabled={!valid || !changed}
            onClick={() => setConfirmOpen(true)}
          >
            Save fee
          </Button>
        </div>
        {!valid ? (
          <p className="mt-2 text-sm text-lose">
            Enter a percentage between 0 and 50.
          </p>
        ) : null}

        {valid ? (
          <div className="mt-5 rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm text-body">
            <p className="font-semibold text-white">
              At {percent}%, on a {formatMoney(sample, "NGN")} example:
            </p>
            <ul className="mt-2 space-y-1">
              <li>
                Paid entry: team pays {formatMoney(entry.gross, "NGN")}, pot
                gets {formatMoney(entry.net, "NGN")}, Gamelyd keeps{" "}
                {formatMoney(entry.fee, "NGN")}.
              </li>
              <li>
                Sponsored board of {formatMoney(sample, "NGN")}: host deposits{" "}
                {formatMoney(deposit.gross, "NGN")}, Gamelyd keeps{" "}
                {formatMoney(deposit.fee, "NGN")}.
              </li>
            </ul>
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-yellow/35 bg-yellow/10 p-4">
          <p className="text-sm text-white">
            This applies to tournaments created from now on.
          </p>
          <p className="mt-1 text-sm text-body">
            Existing tournaments keep the rate they were created with, so hosts
            and players are never charged terms different from the ones they
            registered under.
          </p>
        </div>
      </div>

      <Confirm
        open={confirmOpen}
        title={`Change the platform fee to ${percent}%?`}
        message={`Every tournament created after this uses ${percent}%. Tournaments that already exist are unaffected.`}
        confirmLabel="Change fee"
        loading={saving}
        onConfirm={() => void save()}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

function TypeToggle({
  label,
  blurb,
  enabled,
  busy,
  onToggle,
}: {
  label: string;
  blurb: string;
  enabled: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-2 bg-surface-2/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-body">{blurb}</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center leading-none rounded-full px-2 py-0.5 text-xs font-semibold ${
            enabled ? "bg-win-deep text-white" : "bg-yellow/15 text-yellow"
          }`}
        >
          {enabled ? "Available" : "Coming back soon"}
        </span>
        <Button
          variant={enabled ? "dark" : "default"}
          loading={busy}
          onClick={() => onToggle(!enabled)}
        >
          {enabled ? "Pause" : "Enable"}
        </Button>
      </div>
    </div>
  );
}
