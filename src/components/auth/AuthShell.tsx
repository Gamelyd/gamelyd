import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArenaPattern } from "@/components/layout/ArenaPattern";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-bg lg:flex-row">
      {/* The hex field belongs on the brand half. Behind the form it sits
          under every input and makes the fields hard to pick out. */}
      <div className="relative hidden min-h-screen flex-1 flex-col justify-center overflow-hidden border-b border-white/8 bg-primary-panel/90 px-10 py-16 lg:flex lg:border-b-0 lg:border-r">
        <ArenaPattern />
        <div className="relative z-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary">
            Tournament platform
          </p>
          <h2 className="mt-3 max-w-lg font-display text-5xl leading-none text-white">
            Host matches. Play for the crown.
          </h2>
          <p className="mt-4 max-w-md text-sm text-body">
            Create a tournament, register teams, draw fixtures, and keep scores
            in one place.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {["Knockout", "Groups", "League", "Battle royale"].map((label) => (
              <li
                key={label}
                className="rounded-lg border border-white/12 px-3 py-1.5 text-sm text-white/70"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative z-1 flex min-h-screen w-full flex-col items-center overflow-auto px-6 py-12 lg:w-md lg:shrink-0 xl:w-lg">
        <Link href="/" className="mb-10">
          <Image
            src="/images/logoWhite.png"
            alt="Gamelyd"
            width={180}
            height={72}
            className="h-14 w-auto object-contain"
          />
        </Link>
        <h1 className="mb-8 text-center font-display text-3xl leading-none text-white">
          {title}
        </h1>
        <div className="w-full max-w-md pb-16">{children}</div>
      </div>
    </div>
  );
}
