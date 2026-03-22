import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import HeaderServer from "@/components/header/HeaderServer";
import { MiniCart } from "@/components/cart/MiniCart";
import { CartHydration } from "@/components/cart/CartHydration";
import Footer from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kame.col",
    template: "%s | Kame.col",
  },
  description:
    "Kame.col — prendas y accesorios con diseño premium.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: "Kame.col",
    title: "Kame.col",
    description:
      "Descubre hoodies, camisetas y accesorios con diseño premium.",
    images: [
      {
        url: `${siteUrl}/og/default.jpg`,
        width: 1200,
        height: 630,
        alt: "Kame.col",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kame.col",
    description:
      "Prendas y accesorios con identidad premium.",
    images: [`${siteUrl}/og/default.jpg`],
  },
  icons: {
    // Declare ONLY files that truly exist in frontend/public/
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} bg-stone-50 text-zinc-950 antialiased font-sans`}
      >
        <div className="site-shell min-h-screen bg-stone-50 text-zinc-950">
          <CartHydration />
          <HeaderServer />
          {/*
            Keep the global shell neutral.
            Do not add global top padding here to "fix" internal pages, because that would break
            the full-bleed homepage hero and constrain the PDP hero composition.
            Each view family must resolve its own top spacing through its dedicated shell.
          */}
          <main className="site-main pb-20 md:pb-8">{children}</main>
          <MiniCart />
          <Footer />
        </div>
      </body>
    </html>
  );
}
