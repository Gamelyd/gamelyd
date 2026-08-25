import Link from "next/link";
import Image from "next/image";

const links: { href: string; label: string }[] = [
  { href: "/contact-us", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/policy", label: "Privacy" },
  { href: "/contact-us", label: "Report abuse" },
];

const socials: { icon: string; label: string }[] = [
  { icon: "/icons/twitter.svg", label: "Twitter" },
  { icon: "/icons/linkedin.svg", label: "LinkedIn" },
  { icon: "/icons/facebook.svg", label: "Facebook" },
];

export function Footer() {
  return (
    <footer className="border-t border-surface-2 bg-surface">
      <div className="mx-auto max-w-7xl px-5 py-10">
        <Image
          src="/images/logoWhite.png"
          alt="Gamelyd"
          width={160}
          height={52}
          className="h-10 w-auto"
        />
        <p className="mt-4 max-w-md text-sm text-body">
          Organize game tournaments: create an event, register teams, draw
          fixtures, and keep scores in one place.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l, i) => (
            <Link
              key={`${l.href}-${i}`}
              href={l.href}
              className="text-sm text-body hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-surface-2 pt-6">
          <p className="text-sm text-body">
            © {new Date().getFullYear()} Gamelyd Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {socials.map((s) => (
              <Image
                key={s.label}
                src={s.icon}
                alt={s.label}
                width={20}
                height={20}
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
