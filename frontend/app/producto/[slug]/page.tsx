import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch {
    notFound();
  }
  return <ProductDetailClient product={product} />;
}
