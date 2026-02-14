"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";

// Local fallback type to avoid path/alias issues; keep it minimal for UI rendering.
type Product = {
  id: string | number;
  slug?: string;
  [key: string]: any;
};

type CatalogoResponse = {
  results?: Product[];
  [key: string]: any;
};

async function fetchCatalogo(pageSize: number): Promise<CatalogoResponse> {
  // Force same-origin, and force the trailing slash to avoid Django APPEND_SLASH redirects.
  const url = `/api/catalogo/?${new URLSearchParams({ page_size: String(pageSize) }).toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "same-origin",
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    // Provide a readable error even if backend returned HTML.
    const preview = text.slice(0, 280);
    throw new Error(`API ${res.status}: ${preview}`);
  }

  if (!contentType.includes("application/json")) {
    const preview = text.slice(0, 280);
    throw new Error(`API inválida: esperado JSON, recibí ${contentType || "(sin content-type)"}. ${preview}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 280);
    throw new Error(`API inválida: no pude parsear JSON. ${preview}`);
  }
}

export default function CatalogoClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCatalogo(48);
        if (cancelled) return;
        setProducts((res?.results ?? []) as Product[]);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "No se pudo cargar el catálogo. Revisa /api/catalogo/ en Network.");
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
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-20">
      <header className="mb-10 md:mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Catálogo
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Todos los productos
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-400 md:text-base">
          Productos sin filtros.
        </p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Cargando productos...
        </div>
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

      <div className="mt-10 flex justify-center">
        <Link href="/" className="text-sm text-white/60 hover:text-white/90">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}