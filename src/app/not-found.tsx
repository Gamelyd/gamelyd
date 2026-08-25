import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/Button";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Page not found",
  description: "This page could not be found on Gamelyd.",
  path: "/",
  noIndex: true,
});

export default function NotFound() {
  return (
    <SiteLayout>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-5 py-24 text-center">
        <Image
          src="/icons/ntn.svg"
          alt="Nothing here"
          width={280}
          height={220}
          className="h-auto w-[280px] max-w-full"
        />
        <p className="text-xl text-white">This page could not be found.</p>
        <Link href="/">
          <Button>Back home</Button>
        </Link>
      </div>
    </SiteLayout>
  );
}
