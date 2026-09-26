import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Fofo AI",
  description:
    "Crée des musiques originales inspirées des rythmes traditionnels béninois grâce à l'intelligence artificielle.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
