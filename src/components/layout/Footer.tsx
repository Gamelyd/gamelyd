import Link from "next/link";
import Image from "next/image";

const links: { href: string; label: string }[] = [
  { href: "/contact-us", label: "Contact Us" },
  { href: "/terms", label: "Terms & Condition" },
  { href: "/policy", label: "Privacy & Policy" },
  { href: "/contact-us", label: "Report Abuse" },
];

const socials: { icon: string; label: string }[] = [
  { icon: "/icons/twitter.svg", label: "Twitter" },
  { icon: "/icons/linkedin.svg", label: "LinkedIn" },
  { icon: "/icons/facebook.svg", label: "Facebook" },
];

export function Footer() {
  return (
    <footer className="bg-surface-2 px-[70px] py-[30px] max-[750px]:px-[30px]">
      <div className="flex flex-col">
        <Image
          src="/images/logoWhite.png"
          alt="Gamelyd"
          width={200}
          height={64}
          className="mb-[30px] h-auto w-[200px]"
        />
        <p className="mb-[30px] w-[300px] max-w-full font-inter text-[16px] leading-6 text-purple-soft">
          Gamelyd helps you organize game tournaments: create an event, register
          teams, draw fixtures, and keep scores in one place.
        </p>
        <div className="flex flex-wrap">
          {links.map((l, i) => (
            <Link
              key={`${l.href}-${i}`}
              href={l.href}
              className="mr-[30px] py-2.5 pl-0 font-inter text-[16px] leading-6 text-purple-soft transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-[60px] h-0.5 w-full bg-purple" />

      <div className="mb-5 flex w-full flex-wrap items-center justify-between">
        <div className="mt-10 font-inter text-[16px] leading-6 text-[#d6bbfb]">
          © {new Date().getFullYear()} GAMELYD INC. All rights reserved.
        </div>
        <div className="mt-10 flex items-center">
          {socials.map((s) => (
            <Image
              key={s.label}
              src={s.icon}
              alt={s.label}
              width={24}
              height={24}
              className="ml-5 cursor-pointer"
            />
          ))}
        </div>
      </div>
    </footer>
  );
}
