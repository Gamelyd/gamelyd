"use client";

import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { DownloadViewButton } from "./DownloadViewButton";
import { FALLBACKS, resolveIcon } from "@/lib/icons";
import type { ExportColumn, ExportSide, ExportView } from "@/lib/exportViews";

/**
 * A read-only list of matches, grouped under the same round headings the
 * fixtures tab uses.
 *
 * Both the "unplayed" and "my matches" views are the same shape -- sections of
 * fixtures -- so they share this rather than growing two near-identical lists
 * that drift apart.
 */
export function MatchListModal({
  open,
  onClose,
  title,
  sections,
  empty,
  download,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: ExportColumn[];
  empty: string;
  /** Present only where a public URL can rebuild the same list server-side. */
  download?: {
    tournamentId: string;
    tournamentName: string;
    view: ExportView;
    pages: number;
  };
}) {
  const total = sections.reduce((n, s) => n + s.matches.length, 0);

  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-2xl">
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-body">{empty}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {download ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-body">
                {total} match{total === 1 ? "" : "es"}
              </p>
              <DownloadViewButton
                tournamentId={download.tournamentId}
                tournamentName={download.tournamentName}
                view={download.view}
                pages={download.pages}
                label="Download list"
              />
            </div>
          ) : (
            <p className="text-sm text-body">
              {total} match{total === 1 ? "" : "es"}
            </p>
          )}

          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Tag tone="primarySoft" size="xs">
                  {section.label}
                </Tag>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              {section.matches.map((match, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface px-3 py-2.5"
                >
                  <Side side={match.home} align="left" />
                  <div className="flex w-24 shrink-0 flex-col items-center">
                    <span className="text-sm font-semibold text-white">
                      {match.played
                        ? `${match.home.score} – ${match.away.score}`
                        : "v"}
                    </span>
                    {match.when ? (
                      <span className="text-[11px] text-body">{match.when}</span>
                    ) : null}
                  </div>
                  <Side side={match.away} align="right" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Side({ side, align }: { side: ExportSide; align: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "" : "flex-row-reverse"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveIcon(side.icon, FALLBACKS.team)}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
      <span
        className={`min-w-0 truncate text-sm ${
          side.won ? "font-semibold text-white" : "text-body"
        }`}
      >
        {side.name}
      </span>
    </div>
  );
}
