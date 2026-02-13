import Link from "next/link";
import Image from "next/image";
import type { ProductList } from "@/types/catalog";
import SoldOutBadge from "@/components/badges/SoldOutBadge";

interface ProductCardProps {
  product: ProductList;
}

type AnyRecord = Record<string, any>;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ProductCard({ product }: ProductCardProps) {
  // Some list endpoints may not include variants; keep this resilient.
  const p = product as unknown as AnyRecord;
  const variants: AnyRecord[] = Array.isArray(p.variants) ? p.variants : [];

  // 1) Prefer explicit backend flags when present (most reliable for list views).
  const soldOutFlagRaw =
    p.sold_out ??
    p.is_sold_out ??
    p.isSoldOut ??
    p.soldOut;

  const soldOutFlag =
    typeof soldOutFlagRaw === "boolean" ? soldOutFlagRaw : null;

  // 2) Next, try stock totals if available.
  const stockTotal =
    toNumber(p.stock_total) ??
    toNumber(p.stockTotal) ??
    toNumber(p.total_stock) ??
    toNumber(p.totalStock) ??
    toNumber(p.stock);

  const soldOutFromStockTotal =
    stockTotal !== null ? stockTotal <= 0 : null;

  // 3) Finally, derive from variants only if variant stock is actually present.
  const soldOutFromVariants = (() => {
    if (variants.length === 0) return null;

    let anyKnown = false;
    let allSoldOut = true;

    for (const v of variants) {
      const vStock =
        toNumber(v?.stock) ??
        toNumber(v?.stock_available) ??
        toNumber(v?.stockAvailable) ??
        toNumber(v?.available_stock) ??
        toNumber(v?.availableStock);

      if (vStock === null) continue;
      anyKnown = true;
      if (vStock > 0) {
        allSoldOut = false;
        break;
      }
    }

    return anyKnown ? allSoldOut : null;
  })();

  // 4) Compose final value. If we don't know, don't invent (hide badge).
  const soldOut: boolean | null =
    soldOutFlag !== null
      ? soldOutFlag
      : soldOutFromStockTotal !== null
        ? soldOutFromStockTotal
        : soldOutFromVariants;

  const categoryName = (product as any)?.category?.name ?? "";

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group bg-neutral-900 card-surface border border-white/10 rounded-2xl elevation-soft elevation-hover transition"
    >
      <div className="relative aspect-square w-full overflow-hidden product-media-surface">
        <SoldOutBadge show={soldOut === true} variant="card" />

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
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{categoryName}</p>
        ) : null}

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
