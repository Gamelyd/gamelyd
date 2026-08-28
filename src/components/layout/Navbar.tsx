"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { CatalogAvatar } from "@/components/ui/CatalogAvatar";
import { VerifiedName } from "@/components/ui/VerifiedName";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { getMyOrgInvitesAction } from "@/server/actions/orgActions";

const links: { href: string; label: string; auth?: boolean; admin?: boolean }[] =
  [
    { href: "/", label: "Home" },
    {
      href: "/tournament/all/ALL/ALL",
      label: "Tournaments",
    },
    { href: "/games", label: "Games" },
    { href: "/dashboard", label: "Dashboard", auth: true },
    { href: "/org", label: "Organizations", auth: true },
    { href: "/about", label: "About" },
    { href: "/contact-us", label: "Contact" },
    { href: "/admin", label: "Admin", admin: true },
  ];

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState(0);
  const pathname = usePathname();
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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/tournament/all")) {
      return pathname.startsWith("/tournament/all");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-primary/20 bg-nav">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
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
          {visibleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
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
          {isAuthenticated ? <NotificationBell /> : null}
          <div className="hidden items-center gap-4 md:flex">
            {isAuthenticated && user ? (
              <>
                <button
                  onClick={handleLogout}
                  className="text-sm text-white transition-colors hover:text-primary"
                >
                  Logout
                </button>
                <Link
                  href={`/profile/${user.user_id}`}
                  className="flex items-center gap-2"
                >
                  <CatalogAvatar
                    userId={user.user_id}
                    icon={user.icon}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="flex flex-col leading-tight">
                    <VerifiedName
                      name={user.first_name}
                      verified={user.verified}
                      className="text-sm text-white"
                    />
                    <span className="text-xs text-white/70">
                      @{user.user_name}
                    </span>
                  </span>
                </Link>
              </>
            ) : (
              <Link href="/signup">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
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

      {open && (
        <div className="border-t border-primary/20 bg-nav px-5 py-4 md:hidden">
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
      )}
    </header>
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
