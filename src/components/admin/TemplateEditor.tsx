"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Loader } from "@/components/ui/Loader";
import { Confirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { MODE_LABEL } from "@/lib/plans";
import {
  validateTemplate,
  type TournamentTemplate,
} from "@/lib/tournamentTemplates";
import type { KnockoutFormat, TournamentMode } from "@/lib/schemas/common";
import {
  adminGetTemplatesAction,
  adminResetTemplatesAction,
  adminSetTemplatesAction,
} from "@/server/actions/adminActions";

/**
 * The setup templates offered in the create wizard.
 *
 * Problems are surfaced per template as they are typed, using the same
 * `validateTemplate` the wizard filters on, so an admin sees immediately why a
 * template would not appear to hosts rather than saving it and wondering.
 *
 * Kept short on purpose: a template is a shortcut past the format step, and a
 * long list is just that decision again in a different shape.
 */

const MODES: TournamentMode[] = [
  "MULTIPLAYER",
  "GROUPS",
  "LEAGUE",
  "BATTLEROYALE",
];

/** Mirrors the labels the create wizard uses, so the two never disagree. */
const KNOCKOUT_FORMATS: { value: KnockoutFormat; label: string }[] = [
  { value: "SINGLE", label: "Single match" },
  { value: "TWO_LEG", label: "Two legs" },
  { value: "BO3", label: "Best of 3" },
  { value: "BO5", label: "Best of 5" },
];

function blankTemplate(index: number): TournamentTemplate {
  return {
    id: `template-${index + 1}-${Date.now().toString(36)}`,
    name: "New template",
    blurb: "",
    mode: "MULTIPLAYER",
    size: 8,
    rosterCount: 1,
    returnLeg: false,
    groupCount: 0,
    advancePerGroup: 2,
    knockoutFormat: "SINGLE",
    thirdPlace: false,
    pointsWin: 3,
    pointsDraw: 1,
    enabled: true,
  };
}

function Row({
  template,
  onChange,
  onRemove,
}: {
  template: TournamentTemplate;
  onChange: (next: TournamentTemplate) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof TournamentTemplate>(
    key: K,
    value: TournamentTemplate[K],
  ) => onChange({ ...template, [key]: value });

  const issues = validateTemplate(template);
  const isGroups = template.mode === "GROUPS";
  const isKnockout = template.mode === "MULTIPLAYER";
  const hasTable = template.mode === "LEAGUE" || isGroups;

  return (
    <div className="rounded-xl border border-surface-2 bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          value={template.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <Input
          label="One-line description"
          value={template.blurb}
          onChange={(e) => set("blurb", e.target.value)}
        />
        <Select
          label="Format"
          value={template.mode}
          options={MODES.map((mode) => ({
            value: mode,
            label: MODE_LABEL[mode],
          }))}
          onChange={(e) => set("mode", e.target.value as TournamentMode)}
        />
        <Input
          type="number"
          min={2}
          label="Teams"
          value={String(template.size)}
          onChange={(e) => set("size", Number(e.target.value))}
        />
        <Input
          type="number"
          min={1}
          label="Players per team"
          value={String(template.rosterCount)}
          onChange={(e) => set("rosterCount", Number(e.target.value))}
        />
        {isKnockout ? (
          <Select
            label="How a tie is decided"
            value={template.knockoutFormat}
            options={KNOCKOUT_FORMATS}
            onChange={(e) =>
              set("knockoutFormat", e.target.value as KnockoutFormat)
            }
          />
        ) : null}
        {isGroups ? (
          <>
            <Input
              type="number"
              min={2}
              label="Groups"
              value={String(template.groupCount)}
              onChange={(e) => set("groupCount", Number(e.target.value))}
            />
            <Input
              type="number"
              min={1}
              label="Advance per group"
              value={String(template.advancePerGroup)}
              onChange={(e) => set("advancePerGroup", Number(e.target.value))}
            />
          </>
        ) : null}
        {hasTable ? (
          <>
            <Input
              type="number"
              min={0}
              label="Points for a win"
              value={String(template.pointsWin)}
              onChange={(e) => set("pointsWin", Number(e.target.value))}
            />
            <Input
              type="number"
              min={0}
              label="Points for a draw"
              value={String(template.pointsDraw)}
              onChange={(e) => set("pointsDraw", Number(e.target.value))}
            />
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={template.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Offer to hosts
        </label>
        {hasTable ? (
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={template.returnLeg}
              onChange={(e) => set("returnLeg", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Return leg
          </label>
        ) : null}
        {template.mode !== "BATTLEROYALE" ? (
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={template.thirdPlace}
              onChange={(e) => set("thirdPlace", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Third-place match
          </label>
        ) : null}
        <Button variant="danger" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {issues.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg border border-lose/30 bg-lose/10 p-3 text-xs text-lose">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
          <li className="text-body">
            Hosts will not see this template until it is fixed.
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export function TemplateEditor() {
  const toast = useToast();
  const [rows, setRows] = useState<TournamentTemplate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    void adminGetTemplatesAction().then((result) => {
      if (result.ok) setRows(result.data);
      else toast.error(result.error);
    });
    // Loaded once on mount; the toast helper is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    const result = await adminSetTemplatesAction(rows);
    setSaving(false);
    if (result.ok) {
      setRows(result.data);
      toast.success(result.message ?? "Templates saved");
    } else {
      toast.error(result.error);
    }
  };

  const reset = async () => {
    setResetting(true);
    const result = await adminResetTemplatesAction();
    setResetting(false);
    setResetOpen(false);
    if (result.ok) {
      setRows(result.data);
      toast.success(result.message ?? "Templates reset");
    } else {
      toast.error(result.error);
    }
  };

  if (!rows) return <Loader />;

  const broken = rows.filter((row) => validateTemplate(row).length > 0).length;

  return (
    <div className="mb-6 max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Setup templates</h2>
          <p className="mt-1 text-sm text-body">
            One-click starting points in the create wizard. A host can change
            anything a template fills in. Keep the list short: one or two per
            format is a shortcut, a long list is another decision.
          </p>
        </div>
        <Button variant="outline" onClick={() => setResetOpen(true)}>
          Reset to defaults
        </Button>
      </div>

      <div className="grid gap-4">
        {rows.map((row, index) => (
          <Row
            key={row.id}
            template={row}
            onChange={(next) =>
              setRows(rows.map((r, i) => (i === index ? next : r)))
            }
            onRemove={() => setRows(rows.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => setRows([...rows, blankTemplate(rows.length)])}
        >
          Add template
        </Button>
        <Button loading={saving} onClick={() => void save()}>
          Save templates
        </Button>
        {broken > 0 ? (
          <span className="text-xs text-lose">
            {broken} template{broken === 1 ? "" : "s"} will stay hidden until
            fixed.
          </span>
        ) : null}
      </div>

      <Confirm
        open={resetOpen}
        title="Reset every template?"
        message="The list goes back to the templates shipped in code. Any changes made here are lost."
        confirmLabel="Reset templates"
        loading={resetting}
        onConfirm={() => void reset()}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
