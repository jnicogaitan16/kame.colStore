"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";

import { useCardReveal } from "@/hooks/useCardReveal";
import {
  getProductCardLoadPolicy,
  getProductCardRevealDelayMs,
  getProductCardRevealGroupSize,
} from "@/lib/product-card-policy";
import type { ProductCardSurface } from "@/lib/product-card-policy";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: any[];
  className?: string;
  emptyState?: React.ReactNode;
  surface?: ProductCardSurface;
}

type ProductGridGroupItem = {
  product: any;
  absoluteIndex: number;
  groupIndex: number;
  groupPosition: number;
  revealDelayMs: number;
};

type ProductGridGroup = {
  groupIndex: number;
  items: ProductGridGroupItem[];
};

const PRODUCT_GRID_SECTION_CLASS = "relative w-full px-4 md:px-6";
const PRODUCT_GRID_INNER_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 xl:grid-cols-4 xl:gap-x-6 xl:gap-y-12";

function buildProductGroups(
  products: any[],
  groupSize: number,
  isDesktop: boolean
): ProductGridGroup[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const normalizedGroupSize = Number.isFinite(groupSize) && groupSize > 0 ? groupSize : 1;
  const groups: ProductGridGroup[] = [];

  for (let start = 0; start < products.length; start += normalizedGroupSize) {
    const groupIndex = Math.floor(start / normalizedGroupSize);
    const slice = products.slice(start, start + normalizedGroupSize);

    groups.push({
      groupIndex,
      items: slice.map((product, offset) => {
        const absoluteIndex = start + offset;

        return {
          product,
          absoluteIndex,
          groupIndex,
          groupPosition: offset,
          revealDelayMs: getProductCardRevealDelayMs(
            absoluteIndex,
            normalizedGroupSize,
            isDesktop
          ),
        };
      }),
    });
  }

  return groups;
}

function ProductGridGroup({
  group,
  surface,
  isDesktop,
}: {
  group: ProductGridGroup;
  surface: ProductCardSurface;
  isDesktop: boolean;
}) {
  const firstItem = group.items[0];
  const firstIndex = firstItem?.absoluteIndex ?? Number.MAX_SAFE_INTEGER;
  const loadPolicy = getProductCardLoadPolicy(firstIndex, surface);
  const isFirstGroup = group.groupIndex === 0;
  const revealEnabled = !isFirstGroup;
  const { ref: groupRevealRef, isVisible: observedVisible } = useCardReveal({
    enabled: revealEnabled,
    threshold: loadPolicy.revealThreshold,
    rootMargin: loadPolicy.revealRootMargin,
  });
  const groupVisible = isFirstGroup ? true : observedVisible;
  const cardRevealDeferred = revealEnabled && !groupVisible;

  return (
    <>
      {group.items.map((item, itemIndex) => {
        const stableKey = item.product?.id ?? item.product?.slug;
        const fallbackKey = `${item.product?.name ?? "product"}-${item.product?.price ?? "0"}`;
        const key = String(stableKey ?? fallbackKey);
        const shouldAttachRevealRef = itemIndex === 0 && revealEnabled;

        return (
          <div
            key={key}
            ref={
              shouldAttachRevealRef
                ? (node: HTMLDivElement | null) => {
                    (
                      groupRevealRef as React.MutableRefObject<HTMLElement | null>
                    ).current = node;
                  }
                : undefined
            }
            data-product-group-index={group.groupIndex}
            data-product-group-position={item.groupPosition}
            data-product-group-visible={groupVisible ? "true" : "false"}
            data-product-group-desktop={isDesktop ? "true" : "false"}
            className="min-w-0"
          >
            <ProductCard
              product={item.product}
              index={item.absoluteIndex}
              surface={surface}
              revealDeferred={cardRevealDeferred}
              isVisible={groupVisible}
              revealDelayMs={item.revealDelayMs}
              groupIndex={group.groupIndex}
              groupPosition={item.groupPosition}
            />
          </div>
        );
      })}
    </>
  );
}

export function ProductGrid({
  products,
  className = "",
  emptyState = null,
  surface = "catalog",
}: ProductGridProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncIsDesktop = () => {
      setIsDesktop(mediaQuery.matches);
    };

    syncIsDesktop();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncIsDesktop);
      return () => mediaQuery.removeEventListener("change", syncIsDesktop);
    }

    mediaQuery.addListener(syncIsDesktop);
    return () => mediaQuery.removeListener(syncIsDesktop);
  }, []);

  const groupSize = getProductCardRevealGroupSize(isDesktop);
  const productGroups = useMemo(
    () => buildProductGroups(products, groupSize, isDesktop),
    [products, groupSize, isDesktop]
  );

  if (!Array.isArray(products) || products.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <section
      className={[PRODUCT_GRID_SECTION_CLASS, className].filter(Boolean).join(" ")}
      data-layout="product-grid"
      data-product-group-size={groupSize}
      data-product-grid-desktop={isDesktop ? "true" : "false"}
    >
      <div className={PRODUCT_GRID_INNER_CLASS}>
        {productGroups.map((group) => (
          <ProductGridGroup
            key={`group-${group.groupIndex}`}
            group={group}
            surface={surface}
            isDesktop={isDesktop}
          />
        ))}
      </div>
    </section>
  );
}

export default ProductGrid;