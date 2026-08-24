import type { Metadata } from "next";
import { Roboto, Lalezar, Lato, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import { resolveCurrentUser } from "@/server/services/userService";
import { listUserOrgs } from "@/server/services/orgService";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});
const lalezar = Lalezar({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lalezar",
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Gamelyd — Esports Tournaments",
  description:
    "Create, join and manage esports tournaments. Compete and climb the leaderboard.",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialUser = await resolveCurrentUser();
  const initialOrgs = initialUser
    ? await listUserOrgs(initialUser.user_id)
    : [];

  return (
    <html lang="en">
      <body
        className={`${roboto.variable} ${lalezar.variable} ${lato.variable} ${inter.variable} antialiased`}
      >
        <AuthProvider initialUser={initialUser} initialOrgs={initialOrgs}>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
