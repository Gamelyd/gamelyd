"use client";

import { MODE_LABEL } from "@/lib/plans";
import type { TournamentTemplate } from "@/lib/tournamentTemplates";

/**
 * The shortcut past the format step.
 *
 * A host who has never run an event is being asked for a format, a size, group
 * counts and a points system before they have typed a name. Picking a template
 * answers all of it at once and leaves them with the parts that are actually
 * theirs. Every choice a template makes stays editable underneath -- this fills
 * the form, it does not lock it.
 */
export function TemplatePicker({
  templates,
  activeId,
  onApply,
  onClear,
}: {
  templates: TournamentTemplate[];
  activeId: string;
  onApply: (template: TournamentTemplate) => void;
  onClear: () => void;
}) {
  if (templates.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">
        Start from a template
      </p>
      <p className="mb-3 text-sm text-body">
        Fills in the format and settings below. You can change anything
        afterwards.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const active = activeId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onApply(template)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-white/10 bg-primary-panel hover:border-primary/50"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{template.name}</span>
                {active ? (
                  <span className="text-xs font-semibold text-primary">
                    Applied
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-sm text-body">
                {template.blurb}
              </span>
              <span className="mt-2 block text-xs text-body">
                {MODE_LABEL[template.mode]} · {template.size} teams
                {template.rosterCount > 1
                  ? ` · ${template.rosterCount} per team`
                  : ""}
              </span>
            </button>
          );
        })}
      </div>
      {activeId ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-xs text-body underline hover:text-white"
        >
          Clear template and set everything myself
        </button>
      ) : null}
    </div>
  );
}
