import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Catálogo | Kame.Col",
    description: "Todos los productos disponibles en Kame.Col.",
    openGraph: {
      title: "Catálogo | Kame.Col",
      description: "Todos los productos disponibles en Kame.Col.",
      url: "/catalogo",
      type: "website",
      images: [
        {
          url: "https://kamecol.com/og/default.jpg",
          width: 1200,
          height: 630,
          alt: "Catálogo Kame.Col",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Catálogo | Kame.Col",
      description: "Todos los productos disponibles en Kame.Col.",
      images: ["https://kamecol.com/og/default.jpg"],
    },
  };
}

export default function CatalogoPage() {
  return <CatalogoClient />;
}