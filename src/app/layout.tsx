import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/layout/site-header";
import SiteFooter from "@/components/layout/site-footer";

// One family for everything (Fon tone marks need latin-ext); the width axis
// gives the condensed display cut used for headlines.
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Fofo AI — les rythmes du Bénin", template: "%s · Fofo AI" },
  description:
    "Crée des musiques originales inspirées des rythmes du Bénin — Tchinkounmè, Zinli, Toba — sans formation musicale.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f0c09",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={notoSans.variable}>
      <body className="min-h-dvh">
        <SiteHeader activeLocale="fr" />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
