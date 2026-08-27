"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { seedIconsAction } from "@/server/actions/iconActions";

export function DownloadImagesButton({
  variant = "default",
  onDone,
}: {
  variant?: "default" | "outline" | "dark";
  onDone?: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const result = await seedIconsAction();
    setLoading(false);
    if (result.ok) {
      toast.success(result.message ?? "Catalog updated");
      onDone?.();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Button variant={variant} loading={loading} onClick={() => void run()}>
      Download images
    </Button>
  );
}
