import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

import HeaderServer from "@/components/header/HeaderServer";
import { MiniCart } from "@/components/cart/MiniCart";
import { CartHydration } from "@/components/cart/CartHydration";
import CartAddFlyout from "@/components/cart/CartAddFlyout";
import Footer from "@/components/layout/Footer";
import TrackerInit from "@/components/analytics/TrackerInit";

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
    "Prendas urbanas con enfoque en diseño, calidad y detalle. Marca de ropa urbana en Bogotá, Colombia.",
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: "Kame.col",
    title: "Kame.col",
    description:
      "Prendas urbanas con enfoque en diseño, calidad y detalle. Marca de ropa urbana en Bogotá, Colombia.",
    images: [
      {
        url: `${siteUrl}/og/default.jpg`,
        width: 1200,
        height: 630,
        alt: "Kame.col - Prendas urbanas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kame.col",
    description:
      "Prendas urbanas con enfoque en diseño, calidad y detalle. Marca de ropa urbana en Bogotá, Colombia.",
    images: [`${siteUrl}/og/default.jpg`],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon_tortu.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icon_tortu.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const bodyClass = `${inter.variable} bg-stone-50 text-zinc-950 antialiased font-sans`;

  // Admin tiene su propio layout (sidebar + barra superior). Sin header/carrito/footer de tienda
  // para que el menú hamburguesa del panel sea usable en móvil.
  if (isAdmin) {
    return (
      <html lang="es">
        <body className={bodyClass}>{children}</body>
      </html>
    );
  }

  return (
    <html lang="es">
      <body className={bodyClass}>
        <div className="site-shell min-h-screen bg-stone-50 text-zinc-950">
          <CartHydration />
          <TrackerInit />
          <HeaderServer />
          <CartAddFlyout />
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
