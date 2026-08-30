"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HelpButton } from "@/components/help/HelpButton";
import { helpTarget } from "@/lib/help";
import { getMyOrgInvitesAction } from "@/server/actions/orgActions";

const links: {
  href: string;
  label: string;
  auth?: boolean;
  admin?: boolean;
  /** Lives in the avatar dropdown (desktop) / slide menu (mobile), not the top bar. */
  menuOnly?: boolean;
}[] = [
  { href: "/", label: "Home" },
  {
    href: "/tournament/all/ALL/ALL",
    label: "Tournaments",
  },
  { href: "/games", label: "Games", menuOnly: true },
  { href: "/games?kind=sports", label: "Sports", menuOnly: true },
  { href: "/org", label: "Organizations", auth: true, menuOnly: true },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact-us", label: "Contact" },
  { href: "/admin", label: "Admin", admin: true },
];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    void getMyOrgInvitesAction()
      .then((result) => {
        if (active && result.ok) setPendingInvites(result.data.length);
      })
      .catch(() => {
        // Ignore network blips while the dev server reloads.
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, pathname]);

  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push("/");
  };

  const isAdmin = user?.user_type === "ADMIN";
  const visibleLinks = links.filter((l) => {
    if (l.admin) return isAdmin;
    if (l.auth) return isAuthenticated;
    return true;
  });

  // The avatar dropdown on desktop. Closes on an outside click.
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/tournament/all")) {
      return pathname.startsWith("/tournament/all");
    }
    if (href === "/games?kind=sports") {
      return pathname === "/games" && searchParams.get("kind") === "sports";
    }
    if (href === "/games") {
      return pathname === "/games" && !searchParams.get("kind");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-primary/20 bg-nav">
      <nav className="mx-auto flex max-w-page items-center justify-between px-page py-3">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/logos/logoWhite.png"
            alt="Gamelyd"
            width={160}
            height={52}
            priority
            className="h-10 w-auto md:h-12"
          />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {visibleLinks
            .filter((l) => !l.menuOnly)
            .map((l) => (
            <Link
              key={l.href}
              href={l.href}
              {...(l.href.startsWith("/tournament/all")
                ? helpTarget("nav-tournaments")
                : l.href === "/games"
                  ? helpTarget("nav-games")
                  : l.href === "/games?kind=sports"
                    ? helpTarget("nav-sports")
                    : {})}
              className={`relative text-sm transition-colors hover:text-primary ${
                isActive(l.href) ? "text-primary" : "text-white"
              }`}
            >
              {l.label}
              {l.href === "/org" && pendingInvites > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                  {pendingInvites}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <HelpButton />
          {isAuthenticated ? <NotificationBell /> : null}
          {isAuthenticated && user ? (
            <div className="relative hidden md:block" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/5"
              >
                <CatalogAvatar
                  userId={user.user_id}
                  icon={user.icon}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="flex flex-col leading-tight text-left">
                  <VerifiedName
                    name={user.first_name}
                    verified={user.verified}
                    className="text-sm text-white"
                  />
                  <span className="text-xs text-white/70">
                    @{user.user_name}
                  </span>
                </span>
                <ChevronIcon
                  className={`h-4 w-4 text-white/60 transition-transform duration-200 ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                role="menu"
                className={`absolute right-0 top-full mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-primary/20 bg-nav shadow-xl transition duration-150 ease-out ${
                  userMenuOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                }`}
              >
                <UserMenuLink
                  href={`/profile/${user.user_id}`}
                  onClick={() => setUserMenuOpen(false)}
                >
                  Profile
                </UserMenuLink>
                <UserMenuLink
                  href="/games"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Games
                </UserMenuLink>
                <UserMenuLink
                  href="/games?kind=sports"
                  onClick={() => setUserMenuOpen(false)}
                >
                  Sports
                </UserMenuLink>
                <UserMenuLink
                  href="/org"
                  onClick={() => setUserMenuOpen(false)}
                  badge={pendingInvites}
                >
                  Organizations
                </UserMenuLink>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="block w-full border-t border-primary/15 px-4 py-2.5 text-left text-sm text-pink transition-colors hover:bg-white/5"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden md:block">
              <Link href="/signup">
                <Button>Sign In</Button>
              </Link>
            </div>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-white transition-colors hover:bg-white/5 hover:text-primary md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>
        </div>
      </nav>

      <div
        className={`grid overflow-hidden transition-all duration-300 ease-out md:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`border-t border-primary/20 bg-nav px-page py-4 transition-transform duration-300 ease-out ${
              open ? "translate-y-0" : "-translate-y-3"
            }`}
          >
            <div className="flex flex-col gap-4">
              {visibleLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={closeMenu}
                  className="flex items-center gap-2 text-sm text-white hover:text-primary"
                >
                  {l.label}
                  {l.href === "/org" && pendingInvites > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
                      {pendingInvites}
                    </span>
                  )}
                </Link>
              ))}
              {isAuthenticated && user ? (
                <>
                  <Link
                    href={`/profile/${user.user_id}`}
                    onClick={closeMenu}
                    className="flex items-center gap-2 text-sm text-primary"
                  >
                    <CatalogAvatar
                      userId={user.user_id}
                      icon={user.icon}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    Profile
                  </Link>
                  <Button variant="pink" fullWidth onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <Link href="/signup" onClick={closeMenu}>
                  <Button fullWidth>Sign In</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function UserMenuLink({
  href,
  onClick,
  badge = 0,
  children,
}: {
  href: string;
  onClick: () => void;
  badge?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/5"
    >
      {children}
      {badge > 0 ? (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
