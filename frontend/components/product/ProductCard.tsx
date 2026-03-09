import Link from "next/link";
import { productPath } from "@/lib/routes";
import { getPrimaryImageUrl } from "@/lib/api";

interface ProductCardProps {
  product: any;
}

export function ProductCard({ product }: ProductCardProps) {
  const img = getPrimaryImageUrl(product as any) || "";

  const name = (product as any)?.name ?? "";
  const price = (product as any)?.price ?? "0";
  const slug = (product as any)?.slug ?? "";

  return (
    <Link href={productPath(slug)} className="block card-premium">
      {/* Media FULL-BLEED */}
      <div className="relative card-premium-media card-premium-ratio">
        {img ? (
          <img
            src={img}
            alt={name}
            loading="lazy"
            decoding="async"
            className="card-premium-img"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <span className="type-brand text-white/30">Kame.col</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="card-premium-meta">
        <div className="card-premium-name type-card-title">{name}</div>
        <div className="type-body mt-1 text-white/72">
          ${Number(price).toLocaleString("es-CO")}
        </div>
      </div>
    </Link>
  );
}
