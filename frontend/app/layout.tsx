import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

import HeaderServer from "@/components/header/HeaderServer";
import { MiniCart } from "@/components/cart/MiniCart";
import { CartHydration } from "@/components/cart/CartHydration";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  // Reduce global font payload: include only the weights actually used across the site.
  // Add back weights if you truly need them.
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kame.col Store",
    template: "%s | Kame.col",
  },
  description:
    "Kame.col Store — prendas y accesorios personalizados con diseño premium.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: "Kame.col Store",
    title: "Kame.col Store",
    description:
      "Descubre hoodies, camisetas y accesorios personalizados con diseño premium.",
    images: [
      {
        url: "/og/default.jpg",
        width: 1200,
        height: 630,
        alt: "Kame.col Store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kame.col Store",
    description:
      "Prendas y accesorios personalizados con identidad premium.",
    images: ["/og/default.jpg"],
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
        className={`${jakarta.variable} bg-zinc-950 text-zinc-100 antialiased font-sans`}
      >
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <CartHydration />
          <HeaderServer />
          <main className="pt-16 pb-20 md:pt-18 md:pb-8">{children}</main>
          <MiniCart />

          <Footer />

          <WhatsAppButton
            phone={process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "573137008959"}
          />
        </div>
      </body>
    </html>
  );
}
