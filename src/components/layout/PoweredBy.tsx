import Link from "next/link";

/**
 * The credit line on a public tournament page.
 *
 * This is not decoration: it is the free tier's only cost to the organiser and
 * the whole of what the paid tier removes, so whether it renders is driven by
 * `showsAttribution` on the host's plan rather than by a hardcoded check. It is
 * also the top of the growth loop -- a player who followed a shared link is the
 * cheapest organiser we will ever get.
 */
export function PoweredBy({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="mx-auto max-w-page px-page pb-10 pt-2">
      <p className="border-t border-white/10 pt-5 text-center text-xs text-body">
        Powered by{" "}
        <Link
          href="/"
          className="font-semibold text-primary hover:underline"
        >
          Gamelyd
        </Link>
        {" · "}
        <Link href="/tournament/new" className="hover:underline">
          Run your own tournament, free
        </Link>
      </p>
    </div>
  );
}
