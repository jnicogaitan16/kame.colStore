"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { productPath } from "@/lib/routes";
import { getProductPrimaryImage } from "@/lib/product-media";

interface ProductCardProps {
  product: any;
}

export function ProductCard({ product }: ProductCardProps) {
  const img = getProductPrimaryImage(product) || "";

  const name = (product as any)?.name ?? "";
  const price = (product as any)?.price ?? "0";
  const slug = (product as any)?.slug ?? "";

  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <Link
      ref={cardRef}
      href={productPath(slug)}
      className={`group block card-reveal ${isVisible ? "is-visible" : ""}`}
    >
      {/* Media FULL-BLEED */}
      <div className="relative card-premium-ratio overflow-hidden bg-transparent">
        {img ? (
          <Image
            src={img}
            alt={name || "Producto"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="card-premium-img transition-transform duration-500 ease-out group-hover:scale-[1.012]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-300">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
            </svg>
          </div>
        )}
      </div>

      {/* Meta */}
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
