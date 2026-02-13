// frontend/app/catalogo/page.tsx
import Link from "next/link";
import { getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product/ProductCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CatalogoPage() {
  // Trae “todo” (o lo máximo que soporte tu API)
  const productsRes = await getProducts({ page_size: 48 });
  const products = productsRes?.results ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-12 md:py-20">
      <header className="mb-10 md:mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Catálogo
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Todo lo disponible
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-neutral-400 md:text-base">
          Productos sin filtros — lo que está activo y listo.
        </p>
      </header>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
          Aún no hay productos disponibles.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-8">
          {products.map((p: any) => (
            <ProductCard key={String(p.id)} product={p} />
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <Link
          href="/"
          className="text-sm text-white/60 hover:text-white/90"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}