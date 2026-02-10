import { notFound } from "next/navigation";
import { getCategories, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product/ProductCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page, search } = await searchParams;
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  const [categories, productsRes] = await Promise.all([
    getCategories(),
    getProducts({
      category: slug,
      page: pageNum,
      page_size: 12,
      search: search || undefined,
    }),
  ]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const { results, count, next } = productsRes;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <h1 className="mb-2 text-2xl font-bold text-slate-800 md:text-3xl">
        {category.name}
      </h1>
      <p className="mb-6 text-slate-600">
        {count} producto{count !== 1 ? "s" : ""}
      </p>

      {results.length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          No hay productos en esta categoría.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {next && (
            <div className="mt-8 flex justify-center">
              <a
                href={`/categoria/${slug}?page=${pageNum + 1}`}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Ver más
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
