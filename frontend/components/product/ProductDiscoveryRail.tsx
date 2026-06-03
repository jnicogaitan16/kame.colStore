"use client";

import type { HomepageMarqueeProduct } from "@/lib/api";
import ProductMarqueeCarousel from "@/components/shared/ProductMarqueeCarousel";

type ProductDiscoveryRailProps = {
  title?: string;
  products: HomepageMarqueeProduct[];
};

/**
 * PDP: mismo carrusel que el Home; solo agrega título editorial arriba.
 */
export function ProductDiscoveryRail({
  title = "Descubre más diseños",
  products,
}: ProductDiscoveryRailProps) {
  if (!Array.isArray(products) || products.length === 0) {
    return null;
  }

  return (
    <div className="pdp-discovery-block">
      <div className="pdp-discovery-title-row">
        <h2 id="pdp-discovery-title" className="pdp-label-refined text-zinc-500">
          {title}
        </h2>
      </div>

      <ProductMarqueeCarousel products={products} ariaLabelledBy="pdp-discovery-title" />
    </div>
  );
}
