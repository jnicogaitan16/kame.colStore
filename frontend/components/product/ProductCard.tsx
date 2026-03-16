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
      className={`block card-premium card-reveal ${isVisible ? "is-visible" : ""}`}
    >
      {/* Media FULL-BLEED */}
      <div className="relative card-premium-media card-premium-ratio">
        {img ? (
          <Image
            src={img}
            alt={name || "Producto"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="card-premium-img"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <span className="type-brand text-white/30">Kame.col</span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="card-premium-meta">
        <div className="card-premium-name">{name}</div>
        <div className="card-premium-price">
          ${Number(price).toLocaleString("es-CO")}
        </div>
      </div>
    </Link>
  );
}
