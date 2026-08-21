"use client";

import ProductGrid from "@/components/product/ProductGrid";
import type { Product } from "@/types/catalog";

type CatalogoClientProps = {
  initialProducts?: Product[];
  departmentSlug?: string;
  departmentName?: string;
};

export default function CatalogoClient({
  initialProducts = [],
  departmentSlug,
  departmentName,
}: CatalogoClientProps) {
  const isDepartmentView = Boolean(departmentSlug);
  const title = isDepartmentView
    ? departmentName || departmentSlug || "Departamento"
    : "Catálogo";

  /**
   * Contract:
   * - This component is presentation-only for the catalog initial snapshot.
   * - It must not fetch, rebuild queries, or duplicate server-side catalog loading.
   * - Future filters or pagination should be introduced explicitly, not inferred here.
   */
  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 md:px-6 md:pb-16 elegant-enter">
      <header className="mb-8 md:mb-10">
        <h1 className="type-page-title text-zinc-950">{title}</h1>
      </header>

      <ProductGrid
        products={initialProducts}
        surface="catalog"
        emptyState={
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
            Aún no hay productos disponibles.
          </div>
        }
      />
    </main>
  );
}