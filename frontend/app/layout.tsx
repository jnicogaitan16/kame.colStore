import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

import HeaderServer from "@/components/header/HeaderServer";
import { MiniCart } from "@/components/cart/MiniCart";
import { CartHydration } from "@/components/cart/CartHydration";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kame.Col",
    template: "%s | Kame.Col",
  },
  description:
    "Kame.Col — prendas y accesorios con diseño premium.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: "Kame.Col",
    title: "Kame.Col",
    description:
      "Descubre hoodies, camisetas y accesorios  con diseño premium.",
    images: [
      {
        url: `${siteUrl}/og/default.jpg`,
        width: 1200,
        height: 630,
        alt: "Kame.Col",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kame.Col",
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
        className={`${interTight.variable} bg-zinc-950 text-zinc-100 antialiased font-sans`}
      >
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <CartHydration />
          <HeaderServer />
          <main className="pt-16 pb-20 md:pt-18 md:pb-8">{children}</main>
          <MiniCart />
          <Footer />
          <WhatsAppButton
            phone={process.env.NEXT_PUBLIC_WHATSAPP_PHONE as string}
          />
        </div>
      </body>
    </html>
  );
}
