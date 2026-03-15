import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";
import { getCatalogo } from "@/lib/api";

export const revalidate = 300;

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

export default async function CatalogoPage() {
  const res = await getCatalogo({ page_size: 48 });

  const products = Array.isArray(res?.results) ? res.results : [];

  return <CatalogoClient initialProducts={products} />;
}