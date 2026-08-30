"use client";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * Copies a page link to the clipboard and, where the browser supports it,
 * opens the native share sheet. Works for any shareable page (tournament, org).
 */
export function ShareButton({
  name,
  description,
  urlPath,
  label = "Share",
  variant = "outline",
  className = "",
}: {
  name: string;
  description: string;
  urlPath: string;
  label?: string;
  variant?: "default" | "outline" | "dark";
  className?: string;
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
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={() => void share()}
    >
      {label}
    </Button>
  );
}
