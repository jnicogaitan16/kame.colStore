"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { getCatalogo } from "@/lib/api";
import type { Product } from "@/types/catalog";

export default function CatalogoClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) document.documentElement.dataset.pageLoading = "1";
    else delete document.documentElement.dataset.pageLoading;

    return () => {
      delete document.documentElement.dataset.pageLoading;
    };
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getCatalogo({ page_size: 48 });
        if (cancelled) return;
        setProducts(res?.results ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "No se pudo cargar el catálogo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className={`mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20 ${loading ? "" : "elegant-enter"}`}>
      <header className="mb-10 md:mb-12">
        <p className="type-section-title text-white/50">
          Catálogo
        </p>
        <h1 className="type-page-title mt-3 text-white">
          Todos los productos
        </h1>
        <p className="type-body mt-4 max-w-2xl">
          Productos sin filtros.
        </p>
      </header>

      {loading ? (
        <div className="min-h-[60vh]" aria-hidden="true" />
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-white/80">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Aún no hay productos disponibles.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-8">
          {products.map((p) => (
            <ProductCard key={String((p as any).id)} product={p as any} />
          ))}
        </div>
      )}
    </main>
  );
}