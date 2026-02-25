import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();
  if (!slug) notFound();

  try {
    const product: any = await getProductBySlug(slug);

    // Defensive: some backends return a payload like { detail: "Not found" }
    if (!product || product?.detail === "Not found" || product?.detail === "Not found.") {
      notFound();
    }

    return <ProductDetailClient product={product} />;
  } catch (e: any) {
    // If backend answered 404, this is a true not-found.
    if (typeof e?.status === "number" && e.status === 404) {
      notFound();
    }

    // Otherwise, treat as temporary API failure.
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-white/80">
          No pudimos cargar este producto (API no respondió). Intenta de nuevo en unos segundos.
        </div>
      </main>
    );
  }
}
