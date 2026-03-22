"use client";

import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types/catalog";

type CatalogoClientProps = {
  initialProducts?: Product[];
};

export default function CatalogoClient({
  initialProducts = [],
}: CatalogoClientProps) {

  /**
   * Contract:
   * - This component is presentation-only for the catalog initial snapshot.
   * - It must not fetch, rebuild queries, or duplicate server-side catalog loading.
   * - Future filters or pagination should be introduced explicitly, not inferred here.
   */
  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 md:px-6 md:pb-16 elegant-enter">
      <header className="mb-8 md:mb-10">
        <p className="type-section-title text-zinc-600">Catálogo</p>
        <h1 className="type-page-title mt-3 text-zinc-950">Todos los productos</h1>
        <p className="type-body mt-4 max-w-2xl text-zinc-600">Productos sin filtros.</p>
      </header>

      {initialProducts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
          Aún no hay productos disponibles.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-8">
          {initialProducts.map((product) => (
            <ProductCard key={String(product.id)} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}