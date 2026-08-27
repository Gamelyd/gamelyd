import Image, { type ImageProps } from "next/image";
import { catalogUrl } from "@/lib/icons";

/** Catalog art the same way Admin → Images does: `/api/icons/{slug}` via next/image. */
export function CatalogImage({ src, alt, ...rest }: ImageProps) {
  const nextSrc = typeof src === "string" ? catalogUrl(src) : src;
  if (!nextSrc) return null;
  return <Image alt={alt} src={nextSrc} {...rest} />;
}
