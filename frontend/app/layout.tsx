import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { MiniCart } from "@/components/MiniCart";
import { CartHydration } from "@/components/CartHydration";

export const metadata: Metadata = {
  title: "Kame.col Store",
  description: "Tienda de productos personalizados",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <CartHydration />
        <Header />
        <main className="pb-20 md:pb-8">{children}</main>
        <MiniCart />
      </body>
    </html>
  );
}
