import type { Metadata, Viewport } from "next";
import { Roboto, Lalezar, Lato, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { HelpProvider } from "@/context/HelpContext";
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
  "Gamelyd is where you host and play game tournaments. Create a lobby, register teams, draw fixtures, set match times, and record scores for friends, clubs, and communities.";

const defaultTitle = "Gamelyd: Host and join game tournaments";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://www.gamelyd.com",
  ),
  title: defaultTitle,
  description,
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

  /*
   * The font variables must sit on <html>, not <body>. Tailwind's @theme
   * declares --font-sans/--font-display on :root, so a var(--font-roboto)
   * defined lower down is already out of scope when the theme value computes -
   * the custom property goes invalid and every element silently falls back to
   * the system font stack.
   */
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${lalezar.variable} ${lato.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider initialUser={initialUser} initialOrgs={initialOrgs}>
          <HelpProvider>
            <ToastProvider>{children}</ToastProvider>
          </HelpProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
