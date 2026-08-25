"use client";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ShareTournamentButton({
  name,
  description,
  urlPath,
}: {
  name: string;
  description: string;
  urlPath: string;
}) {
  const toast = useToast();

  const share = async () => {
    const url = `${window.location.origin}${urlPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: description, url });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  };

  return (
    <Button type="button" variant="outline" onClick={() => void share()}>
      Share
    </Button>
  );
}
