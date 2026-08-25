"use client";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ShareTournamentButton({
  name,
  urlPath,
}: {
  name: string;
  urlPath: string;
}) {
  const toast = useToast();

  const share = async () => {
    const url =
      typeof window === "undefined"
        ? urlPath
        : `${window.location.origin}${urlPath}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url, text: name });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <Button type="button" variant="outline" onClick={() => void share()}>
      Share
    </Button>
  );
}
