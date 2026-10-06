import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/layout/site-header";
import SiteFooter from "@/components/layout/site-footer";
import MobileTabBar from "@/components/layout/mobile-tab-bar";
import PlayerProvider from "@/components/player/player-provider";
import PlayerBar from "@/components/player/player-bar";
import { ToastProvider } from "@/components/ui/toast";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// One family for everything (Fon tone marks need latin-ext); the width axis
// gives the condensed display cut used for headlines.
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Fofo AI — les rythmes du Bénin", template: "%s · Fofo AI" },
  description:
    "Crée des musiques originales inspirées des rythmes du Bénin — Tchinkounmè, Zinli, Toba — sans formation musicale.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f0c09",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const headerUser = user ? { email: user.email ?? "" } : null;

  return (
    <html lang="fr" className={notoSans.variable}>
      <body className="min-h-dvh">
        <ToastProvider>
          <PlayerProvider>
            <SiteHeader user={headerUser} />
            {children}
            <SiteFooter />
            <PlayerBar />
            <MobileTabBar signedIn={Boolean(user)} />
          </PlayerProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
