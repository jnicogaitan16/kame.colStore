"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getProductCardLoadPolicy } from "@/lib/product-card-policy";
import type { ProductCardSurface } from "@/lib/product-card-policy";
import { getProductCardImageCandidates } from "@/lib/product-media";
import { productPath } from "@/lib/routes";

interface ProductCardProps {
  product: any;
  index?: number;
  surface?: ProductCardSurface;
  isVisible?: boolean;
  revealDeferred?: boolean;
  revealDelayMs?: number;
  groupIndex?: number;
  groupPosition?: number;
}

export function ProductCard({
  product,
  index,
  surface = "catalog",
  isVisible = true,
  revealDeferred = false,
  revealDelayMs = 0,
  groupIndex,
  groupPosition,
}: ProductCardProps) {
  const imageCandidates = getProductCardImageCandidates(product);
  const imageCandidatesKey = useMemo(() => imageCandidates.join("|"), [imageCandidates]);

  const name = (product as any)?.name ?? "";
  const price = (product as any)?.price ?? "0";
  const slug = (product as any)?.slug ?? "";

  const safeIndex =
    typeof index === "number" && Number.isFinite(index)
      ? index
      : Number.MAX_SAFE_INTEGER;
  const loadPolicy = getProductCardLoadPolicy(safeIndex, surface);

  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [product?.id, product?.slug, imageCandidatesKey]);

  const img = imageCandidates[imageIndex] || "";

  return (
    <Link
      href={productPath(slug)}
      className={[
        "group block",
        revealDeferred ? "card-reveal" : "",
        isVisible ? "is-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        revealDeferred
          ? ({ ["--card-reveal-delay" as any]: `${Math.max(0, revealDelayMs)}ms` } as React.CSSProperties)
          : undefined
      }
      data-product-group-index={groupIndex}
      data-product-group-position={groupPosition}
    >
      <div className="relative card-premium-ratio overflow-hidden bg-transparent">
        {img && !imageFailed ? (
          <Image
            src={img}
            alt={name || "Producto"}
            fill
            priority={loadPolicy.priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="card-premium-img transition-transform duration-500 ease-out group-hover:scale-[1.012]"
            loading={loadPolicy.loading}
            fetchPriority={loadPolicy.fetchPriority}
            onError={() => {
              if (imageIndex < imageCandidates.length - 1) {
                setImageIndex((current) => current + 1);
                return;
              }
              setImageFailed(true);
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-300">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
            </svg>
          </div>
        )}
      </div>

      <div className="pt-3.5 pb-0.5">
        <div className="type-card-title text-zinc-900 leading-[1.18] tracking-[0.015em]">
          {name}
        </div>
        <div className="mt-1.5 type-price text-[0.82rem] text-zinc-500">
          ${Number(price).toLocaleString("es-CO")}
        </div>
      </div>
    </Link>
  );
}