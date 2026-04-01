import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";
import { getCatalogo } from "@/lib/api";

/**
 * SERVER ENTRY (CATÁLOGO)
 *
 * Responsabilidad:
 * - Obtener el snapshot inicial de productos desde backend.
 * - Entregar datos al client (CatalogoClient).
 *
 * No es responsable de:
 * - Política de imágenes (priority, loading, fetchPriority)
 * - Reveal / IntersectionObserver
 * - Heurísticas visuales de grid o cards
 *
 * Toda la lógica visual y de loading vive en:
 * - ProductGrid
 * - ProductCard
 * - product-card-policy
 * - useCardReveal
 */

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
  const [catalogoResult] = await Promise.allSettled([getCatalogo({ page_size: 48 })]);

  const res = catalogoResult.status === "fulfilled" ? catalogoResult.value : null;
  const products = Array.isArray(res?.results) ? res.results : [];

  return (
    <section className="page-shell page-shell--with-header">
      <div className="page-content-start page-body">
        <CatalogoClient initialProducts={products} />
      </div>
    </section>
  );
}