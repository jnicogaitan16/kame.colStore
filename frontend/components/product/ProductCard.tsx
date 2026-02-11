import Link from "next/link";
import Image from "next/image";
import type { ProductList } from "@/types/catalog";

interface ProductCardProps {
  product: ProductList;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group bg-neutral-900 card-surface border border-white/10 rounded-2xl elevation-soft elevation-hover transition"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-800">
        {product.primary_image ? (
          <Image
            src={product.primary_image}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3 md:p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {product.category.name}
        </p>
        <h3 className="mt-0.5 font-semibold text-neutral-100 line-clamp-2 group-hover:text-white">
          {product.name}
        </h3>
        <p className="mt-2 text-lg font-semibold text-sky-400">
          ${parseFloat(product.price).toLocaleString("es-CO")}
        </p>
      </div>
    </Link>
  );
}
