"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ingestIconFilesAction } from "@/server/actions/iconActions";

export function UploadCatalogButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const run = async () => {
    setBusy(true);
    setStatus("Uploading…");
    try {
      for (;;) {
        const result = await ingestIconFilesAction();
        if (!result.ok) {
          toast.error(result.error);
          setStatus("");
          return;
        }
        const { remaining, total } = result.data;
        if (remaining > 0) {
          setStatus(`Saved ${total - remaining} of ${total}…`);
          continue;
        }
        toast.success(result.message ?? "Catalog images are in the database");
        setStatus("");
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" loading={busy} onClick={() => void run()}>
        Upload catalog to database
      </Button>
      {status ? <p className="text-xs text-body">{status}</p> : null}
    </div>
  );
}
