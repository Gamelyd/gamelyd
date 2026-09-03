"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Loader } from "@/components/ui/Loader";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import {
  MODE_LABEL,
  PLAN_ORDER,
  type Plan,
  type PlanConfig,
  type PlanInterval,
  type PlanLimits,
} from "@/lib/plans";
import type { Currency, TournamentMode } from "@/lib/schemas/common";
import {
  adminGetPlansAction,
  adminResetPlansAction,
  adminSetPlanLimitsAction,
} from "@/server/actions/adminActions";

/**
 * The plan desk: every tier limit, price and branding flag, editable without a
 * deploy. These are the live values the create gate reads, so a change here
 * applies to the next tournament anyone starts.
 *
 * Numbers are held as strings while editing so a half-typed field does not
 * momentarily read as 0, and an empty "unlimited" field stays distinguishable
 * from a zero the admin actually meant. The server re-validates everything with
 * `planLimitsSchema`, so nothing here is a security boundary.
 */

interface Draft {
  label: string;
  blurb: string;
  maxTeams: string;
  maxVenues: string;
  maxActive: string;
  maxManagers: string;
  modes: TournamentMode[];
  canHostAsOrg: boolean;
  canBrand: boolean;
  showsAttribution: boolean;
  sold: boolean;
  price: string;
  currency: Currency;
  interval: PlanInterval;
}

const ALL_MODES: TournamentMode[] = [
  "MULTIPLAYER",
  "GROUPS",
  "LEAGUE",
  "BATTLEROYALE",
];

function toDraft(limits: PlanLimits): Draft {
  return {
    label: limits.label,
    blurb: limits.blurb,
    maxTeams: String(limits.maxTeams),
    maxVenues: String(limits.maxVenues),
    maxActive: limits.maxActive === null ? "" : String(limits.maxActive),
    maxManagers: limits.maxManagers === null ? "" : String(limits.maxManagers),
    modes: [...limits.modes],
    canHostAsOrg: limits.canHostAsOrg,
    canBrand: limits.canBrand,
    showsAttribution: limits.showsAttribution,
    sold: limits.sold,
    price: (limits.priceMinor / 100).toFixed(2),
    currency: limits.currency,
    interval: limits.interval,
  };
}

/** An empty capacity field means unlimited, which is why these are nullable. */
function optionalCount(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function fromDraft(draft: Draft): PlanLimits {
  return {
    label: draft.label.trim(),
    blurb: draft.blurb.trim(),
    maxTeams: Number(draft.maxTeams),
    modes: draft.modes,
    maxActive: optionalCount(draft.maxActive),
    maxManagers: optionalCount(draft.maxManagers),
    maxVenues: Number(draft.maxVenues),
    canHostAsOrg: draft.canHostAsOrg,
    canBrand: draft.canBrand,
    showsAttribution: draft.showsAttribution,
    priceMinor: Math.round(Number(draft.price || "0") * 100),
    currency: draft.currency,
    interval: draft.interval,
    sold: draft.sold,
  };
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        {label}
        <span className="block text-xs text-body">{hint}</span>
      </span>
    </label>
  );
}

function PlanCard({
  plan,
  draft,
  setDraft,
  onSave,
  saving,
}: {
  plan: Plan;
  draft: Draft;
  setDraft: (next: Draft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });

  const toggleMode = (mode: TournamentMode) => {
    const next = draft.modes.includes(mode)
      ? draft.modes.filter((m) => m !== mode)
      : [...draft.modes, mode];
    // At least one format has to remain, or the tier can create nothing at all.
    if (next.length > 0) set("modes", next);
  };

  return (
    <div className="rounded-2xl border border-surface-2 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">
          {draft.label || plan}{" "}
          <span className="text-xs font-normal text-body">({plan})</span>
        </h3>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Name shown to hosts"
          value={draft.label}
          onChange={(e) => set("label", e.target.value)}
        />
        <Input
          label="One-line description"
          value={draft.blurb}
          onChange={(e) => set("blurb", e.target.value)}
        />
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-body">
        Limits
      </p>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          min={2}
          label="Max teams per tournament"
          value={draft.maxTeams}
          onChange={(e) => set("maxTeams", e.target.value)}
        />
        <Input
          type="number"
          min={1}
          label="Max venues per event"
          value={draft.maxVenues}
          onChange={(e) => set("maxVenues", e.target.value)}
        />
        <Input
          type="number"
          min={1}
          label="Tournaments at once (blank = unlimited)"
          value={draft.maxActive}
          onChange={(e) => set("maxActive", e.target.value)}
        />
        <Input
          type="number"
          min={0}
          label="Co-managers (blank = unlimited)"
          value={draft.maxManagers}
          onChange={(e) => set("maxManagers", e.target.value)}
        />
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-body">
        Formats
      </p>
      <div className="mt-2 flex flex-wrap gap-4">
        {ALL_MODES.map((mode) => (
          <label
            key={mode}
            className="flex items-center gap-2 text-sm text-white"
          >
            <input
              type="checkbox"
              checked={draft.modes.includes(mode)}
              onChange={() => toggleMode(mode)}
              className="h-4 w-4 accent-primary"
            />
            {MODE_LABEL[mode]}
          </label>
        ))}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-body">
        Price
      </p>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          label="Price (0 = free)"
          value={draft.price}
          onChange={(e) => set("price", e.target.value)}
        />
        <Select
          label="Currency"
          value={draft.currency}
          options={CURRENCY_OPTIONS}
          onChange={(e) => set("currency", e.target.value as Currency)}
        />
        <Select
          label="Billing"
          value={draft.interval}
          options={[
            { value: "NONE", label: "Not billed" },
            { value: "MONTH", label: "Per month" },
            { value: "YEAR", label: "Per year" },
          ]}
          onChange={(e) => set("interval", e.target.value as PlanInterval)}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Toggle
          label="Can host as an organization"
          hint="Publish events under a club's name."
          checked={draft.canHostAsOrg}
          onChange={(v) => set("canHostAsOrg", v)}
        />
        <Toggle
          label="Custom branding"
          hint="Own colours and imagery on the tournament page."
          checked={draft.canBrand}
          onChange={(v) => set("canBrand", v)}
        />
        <Toggle
          label='Show "Powered by Gamelyd"'
          hint="The credit on public pages. Removing it is what the paid tier sells."
          checked={draft.showsAttribution}
          onChange={(v) => set("showsAttribution", v)}
        />
        <Toggle
          label="Offer on the pricing page"
          hint="Turn off to keep a tier admin-only."
          checked={draft.sold}
          onChange={(v) => set("sold", v)}
        />
      </div>

      <div className="mt-5">
        <Button loading={saving} onClick={onSave}>
          Save {draft.label || plan}
        </Button>
      </div>
    </div>
  );
}

export function PlanEditor() {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<Plan, Draft> | null>(null);
  const [saving, setSaving] = useState<Plan | "">("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = (config: PlanConfig) =>
    setDrafts(
      Object.fromEntries(
        PLAN_ORDER.map((plan) => [plan, toDraft(config[plan])]),
      ) as Record<Plan, Draft>,
    );

  useEffect(() => {
    void adminGetPlansAction().then((result) => {
      if (result.ok) load(result.data);
      else toast.error(result.error);
    });
    // Loaded once on mount; the toast helper is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (plan: Plan) => {
    if (!drafts) return;
    setSaving(plan);
    const result = await adminSetPlanLimitsAction(plan, fromDraft(drafts[plan]));
    setSaving("");
    if (result.ok) {
      load(result.data);
      toast.success(result.message ?? "Plan updated");
    } else {
      toast.error(result.error);
    }
  };

  const reset = async () => {
    setResetting(true);
    const result = await adminResetPlansAction();
    setResetting(false);
    setResetOpen(false);
    if (result.ok) {
      load(result.data);
      toast.success(result.message ?? "Plans reset");
    } else {
      toast.error(result.error);
    }
  };

  if (!drafts) return <Loader />;

  return (
    <div className="mb-6 max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Plans</h2>
          <p className="mt-1 text-sm text-body">
            The live limits every tournament is checked against. Changes apply to
            the next tournament created; events already running are never
            re-checked, so lowering a limit cannot strand anyone.
          </p>
        </div>
        <Button variant="outline" onClick={() => setResetOpen(true)}>
          Reset to defaults
        </Button>
      </div>

      <div className="grid gap-5">
        {PLAN_ORDER.map((plan) => (
          <PlanCard
            key={plan}
            plan={plan}
            draft={drafts[plan]}
            setDraft={(next) => setDrafts({ ...drafts, [plan]: next })}
            onSave={() => void save(plan)}
            saving={saving === plan}
          />
        ))}
      </div>

      <Confirm
        open={resetOpen}
        title="Reset every plan?"
        message="All tiers go back to the limits and prices shipped in code. Any changes made here are lost."
        confirmLabel="Reset plans"
        loading={resetting}
        onConfirm={() => void reset()}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
