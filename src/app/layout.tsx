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

const description =
  "Gamelyd is a tournament organizer for games. Create a tournament, register teams, draw fixtures, set match times, and record scores — for friends, clubs, and communities.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.gamelyd.co",
  ),
  title: "Gamelyd — Host and join game tournaments",
  description,
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Gamelyd — Host and join game tournaments",
    description,
    siteName: "Gamelyd",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Gamelyd — Host and join game tournaments",
    description,
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${roboto.variable} ${lalezar.variable} ${lato.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider initialUser={initialUser} initialOrgs={initialOrgs}>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
