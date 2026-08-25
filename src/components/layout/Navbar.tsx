"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { getMyOrgInvitesAction } from "@/server/actions/orgActions";
import { playerIconFor } from "@/lib/icons";

const links: { href: string; label: string; auth?: boolean; admin?: boolean }[] =
  [
    { href: "/", label: "Home" },
    {
      href: "/tournament/all/ALL/ALL",
      label: "Tournaments",
    },
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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-2 bg-nav">
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

        <div className="hidden items-center gap-3 md:flex">
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
                <Image
                  src={playerIconFor(user.user_id)}
                  alt="user"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm text-white">{user.first_name}</span>
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
          className="text-2xl text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </nav>

      {open && (
        <div className="border-t border-surface-2 bg-nav px-5 py-4 md:hidden">
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
                  className="text-sm text-primary"
                >
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
