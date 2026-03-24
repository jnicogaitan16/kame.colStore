"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { productPath } from "@/lib/routes";

interface ProductCardProps {
  product: any;
  index?: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  const imageCandidates = [
    product?.primary_thumb_url,
    product?.primary_medium_url,
    product?.primary_image,
  ].filter((value, index, array): value is string => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return array.findIndex((item) => item === value) === index;
  });

  const name = (product as any)?.name ?? "";
  const price = (product as any)?.price ?? "0";
  const slug = (product as any)?.slug ?? "";

  const safeIndex = typeof index === "number" ? index : Number.MAX_SAFE_INTEGER;
  const isAboveTheFold = safeIndex < 4;
  const isPriorityImage = safeIndex < 2;

  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const [isVisible, setIsVisible] = useState(isAboveTheFold);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setImageFailed(false);
  }, [
    product?.id,
    product?.slug,
    product?.primary_thumb_url,
    product?.primary_medium_url,
    product?.primary_image,
  ]);

  useEffect(() => {
    if (isAboveTheFold) {
      if (!isVisible) setIsVisible(true);
      return;
    }

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
  }, [isAboveTheFold, isVisible]);

  const img = imageCandidates[imageIndex] || "";

  return (
    <Link
      ref={cardRef}
      href={productPath(slug)}
      className={`group block ${isAboveTheFold ? "" : "card-reveal"} ${isVisible ? "is-visible" : ""}`.trim()}
    >
      <div className="relative card-premium-ratio overflow-hidden bg-transparent">
        {img && !imageFailed ? (
          <Image
            src={img}
            alt={name || "Producto"}
            fill
            priority={isPriorityImage}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
            className="card-premium-img transition-transform duration-500 ease-out group-hover:scale-[1.012]"
            loading={isAboveTheFold ? "eager" : "lazy"}
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