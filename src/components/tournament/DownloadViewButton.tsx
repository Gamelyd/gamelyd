"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EXPORT_VIEW_LABEL, type ExportView } from "@/lib/exportViews";
import { exportFileName } from "@/lib/exportImage";

/**
 * Saves the part of the tournament currently on screen as an image.
 *
 * The picture is drawn on the server, so a host on a phone gets the same wide
 * layout a desktop would. That drawing takes a moment, and a plain download
 * link gives no sign it is happening -- the page just sits there and people
 * click again. So the file is fetched here instead, and the button says what it
 * is doing until the image actually arrives.
 */
export function DownloadViewButton({
  tournamentId,
  tournamentName,
  view,
  label,
  pages = 1,
  className = "",
}: {
  tournamentId: string;
  tournamentName: string;
  view: ExportView;
  label?: string;
  /** Images this view needs. Big tournaments span more than one. */
  pages?: number;
  className?: string;
}) {
  const toast = useToast();
  /** The page currently being made; 0 while idle. */
  const [busy, setBusy] = useState(0);
  const name = EXPORT_VIEW_LABEL[view];
  const total = Math.max(1, pages);

  const save = async (page: number) => {
    if (busy) return;
    setBusy(page);
    const fileName = exportFileName(
      tournamentName,
      total > 1 ? `${name} ${page} of ${total}` : name,
    );
    let href = "";
    try {
      const url =
        total > 1
          ? `/tournament/${tournamentId}/export/${view}?page=${page}`
          : `/tournament/${tournamentId}/export/${view}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(String(response.status));

      href = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Could not create that image. Try again in a moment.");
    } finally {
      // Revoking straight away can cancel the save while the browser is still
      // reading the blob, so let it go out of scope a moment later.
      if (href) window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
      setBusy(0);
    }
  };

  // A tournament too big for one picture gets a button per part rather than a
  // single one that quietly hands back the first slice.
  const parts = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <>
      {parts.map((page) => (
        <Button
          key={page}
          type="button"
          variant="outline"
          className={className}
          loading={busy === page}
          disabled={busy !== 0 && busy !== page}
          onClick={() => void save(page)}
        >
          {busy === page ? null : <DownloadGlyph />}
          {busy === page
            ? "Creating image…"
            : total > 1
              ? `Download ${page}/${total}`
              : (label ?? `Download ${name.toLowerCase()}`)}
        </Button>
      ))}
    </>
  );
}

function DownloadGlyph() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}
