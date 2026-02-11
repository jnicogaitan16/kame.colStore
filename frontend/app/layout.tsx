import type { Metadata } from "next";
import "./globals.css";

import HeaderServer from "@/components/header/HeaderServer";
import { MiniCart } from "@/components/cart/MiniCart";
import { CartHydration } from "@/components/cart/CartHydration";
import Footer from "@/components/layout/Footer";
import WhatsAppButton from "@/components/layout/WhatsAppButton";

import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Kame.col Store",
  description: "Tienda de productos personalizados",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${jakarta.variable} bg-zinc-950 text-zinc-100 antialiased font-sans`}>
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
