"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { catalogUrl } from "@/lib/icons";

/** Catalog art the same way Admin → Images does: `/api/icons/{slug}` via next/image. */
export function CatalogImage({
  src,
  alt,
  /*
   * A catalog row can point at a slug whose file is missing from storage. The
   * image then fails and the browser paints the alt text across the artwork,
   * which on a cover card reads as a broken page. Swap to a known-good cover
   * instead.
   */
  fallbackSrc = "/api/icons/eafc-01-center-spot",
  ...rest
}: ImageProps & { fallbackSrc?: string }) {
  const nextSrc = typeof src === "string" ? catalogUrl(src) : src;
  /*
   * Remembering which URL failed (rather than a boolean) means a card that
   * gets a new src retries on its own, with no effect to reset the flag.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!nextSrc) return null;

  const failed = typeof nextSrc === "string" && failedSrc === nextSrc;
  const resolved = failed ? catalogUrl(fallbackSrc) : nextSrc;

  return (
    <Image
      alt={alt}
      src={resolved}
      onError={() => {
        if (typeof nextSrc === "string") setFailedSrc(nextSrc);
      }}
      {...rest}
    />
  );
}
