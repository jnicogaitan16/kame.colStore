import type { Metadata } from "next";
import "./globals.css";

import HeaderServer from "@/components/HeaderServer";
import { MiniCart } from "@/components/MiniCart";
import { CartHydration } from "@/components/CartHydration";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

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
      <body className="min-h-screen antialiased">
        <CartHydration />
        <HeaderServer />
        <main className="pb-20 md:pb-8">{children}</main>
        <MiniCart />

        <Footer />

        <WhatsAppButton
          phone={process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "573137008959"}
        />
      </body>
    </html>
  );
}
