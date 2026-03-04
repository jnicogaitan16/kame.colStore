import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Catálogo | Kame.col",
    description: "Todos los productos disponibles en Kame.col.",
    openGraph: {
      title: "Catálogo | Kame.col",
      description: "Todos los productos disponibles en Kame.col.",
      url: "/catalogo",
      type: "website",
      images: [
        {
          url: "/og/catalogo.jpg",
          width: 1200,
          height: 630,
          alt: "Catálogo Kame.col",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Catálogo | Kame.col",
      description: "Todos los productos disponibles en Kame.col.",
      images: ["/og/catalogo.jpg"],
    },
  };
}

export default function CatalogoPage() {
  return <CatalogoClient />;
}