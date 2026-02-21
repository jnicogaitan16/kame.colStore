import Link from "next/link";
import type { ProductList } from "@/types/catalog";
import SoldOutBadge from "@/components/badges/SoldOutBadge";

interface ProductCardProps {
  product: ProductList;
}

export function ProductCard({ product }: ProductCardProps) {
  // Fuente de verdad (backend): usar sold_out estrictamente.
  const soldOut = product.sold_out === true;

  const categoryName = (product as any)?.category?.name ?? "";

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group bg-neutral-900 card-surface border border-white/10 rounded-2xl elevation-soft transition will-change-transform hover:border-white/20 hover:-translate-y-[1px]"
    >
      <div className="relative aspect-square w-full overflow-hidden product-media-surface">
        <SoldOutBadge show={soldOut} variant="card" />

        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4">
        {categoryName ? (
          <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-300">
            {categoryName}
          </span>
        ) : null}

        <h3 className="mt-2 text-[15px] md:text-base font-semibold leading-snug text-neutral-100 line-clamp-2 group-hover:text-white">
          {product.name}
        </h3>

        <p className="mt-2 text-xl font-semibold text-cyan-300 transition-colors group-hover:text-cyan-200">
          ${parseFloat(product.price).toLocaleString("es-CO")}
        </p>
      </div>
    </Link>
  );
}
