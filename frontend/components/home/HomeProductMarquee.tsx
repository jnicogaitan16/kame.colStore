"use client";

import type { HomepageMarqueeProduct } from "@/lib/api";
import ProductMarqueeCarousel from "@/components/shared/ProductMarqueeCarousel";

type Props = {
  products: HomepageMarqueeProduct[];
};

export default function HomeProductMarquee({ products }: Props) {
  return (
    <ProductMarqueeCarousel
      products={products}
      ariaLabel="Selección destacada de productos"
    />
  );
}
