import type { Metadata } from "next";
import CatalogoClient from "./CatalogoClient";
import { getCatalogo, getNavigation, getProducts } from "@/lib/api";

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

type PageProps = {
  searchParams: Promise<{ dept?: string; page?: string; search?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { dept } = await searchParams;
  const deptSlug = typeof dept === "string" && dept.trim() ? dept.trim() : undefined;

  if (!deptSlug) {
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

  let departmentName = deptSlug;
  try {
    const nav = await getNavigation();
    const match = nav?.departments?.find((item) => item.slug === deptSlug);
    if (match?.name) departmentName = match.name;
  } catch {
    // Metadata fallback keeps slug-based title.
  }

  const title = `${departmentName} | Catálogo | Kame.Col`;
  const description = `Todos los productos de ${departmentName} en Kame.Col.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/catalogo?dept=${encodeURIComponent(deptSlug)}`,
      type: "website",
      images: [
        {
          url: "https://kamecol.com/og/default.jpg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://kamecol.com/og/default.jpg"],
    },
  };
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const { dept, page, search } = await searchParams;
  const deptSlug = typeof dept === "string" && dept.trim() ? dept.trim() : undefined;
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  const [catalogoResult, navResult] = await Promise.allSettled([
    deptSlug
      ? getProducts({
          department: deptSlug,
          page: pageNum,
          page_size: 48,
          search: search || undefined,
        })
      : getCatalogo({ page_size: 48 }),
    deptSlug ? getNavigation() : Promise.resolve(null),
  ]);

  const res = catalogoResult.status === "fulfilled" ? catalogoResult.value : null;
  const products = Array.isArray(res?.results) ? res.results : [];

  let departmentName: string | undefined;
  if (deptSlug && navResult.status === "fulfilled") {
    const match = navResult.value?.departments?.find((item) => item.slug === deptSlug);
    departmentName = match?.name || deptSlug;
  }

  return (
    <section className="page-shell page-shell--with-header">
      <div className="page-content-start page-body">
        <CatalogoClient
          initialProducts={products}
          departmentSlug={deptSlug}
          departmentName={departmentName}
        />
      </div>
    </section>
  );
}