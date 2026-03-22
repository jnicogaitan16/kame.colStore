import { notFound } from "next/navigation";
import { getNavigation, getProducts } from "@/lib/api";
import ProductGrid from "@/components/product/ProductGrid";
import { categoryPath } from "@/lib/routes";
import type { PaginatedResponse, Product } from "@/types/catalog";

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; search?: string; dept?: string }>;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();
  if (!slug) notFound();

  const { page, search, dept } = await searchParams;
  const deptSlug = typeof dept === "string" && dept.trim() ? dept.trim() : undefined;
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  // Importante: products es la fuente de verdad para resolver categoría/departamento.
  const [navRes, productsRes0] = await Promise.allSettled([
    getNavigation(),
    getProducts({
      category: slug, // <- coincide con Django: /api/products/?category=cuadros
      department: deptSlug, // <- CLAVE: filtro real por dept (querystring ?dept=...)
      page: pageNum,
      page_size: 12,
      search: search || undefined,
    }),
  ]);

  const nav = navRes.status === "fulfilled" ? navRes.value : null;

  const productsRes: PaginatedResponse<Product> =
    productsRes0.status === "fulfilled"
      ? (productsRes0.value as PaginatedResponse<Product>)
      : ({ results: [], count: 0, next: null, previous: null } as any);

  const results: Product[] = Array.isArray((productsRes as any)?.results)
    ? ((productsRes as any).results as Product[])
    : [];

  const count = Number((productsRes as any)?.count ?? results.length ?? 0);
  const next = (productsRes as any)?.next ?? null;

  // ✅ Derivar nombre de categoría/departamento desde el primer producto (si existe)
  const first = results[0] as any;

  const categoryFromProducts = first?.category
    ? {
        id: Number(first.category?.id) || 0,
        name: String(first.category?.name || ""),
        slug: String(first.category?.slug || slug),
      }
    : null;

  const departmentFromProducts = first?.category?.department
    ? {
        id: Number(first.category.department?.id) || 0,
        name: String(first.category.department?.name || ""),
        slug: String(first.category.department?.slug || ""),
      }
    : null;

  // ✅ Fallback: si no hay productos pero el nav existe, intenta resolver por nav para el título (sin 404)
  const departments = Array.isArray((nav as any)?.departments)
    ? (nav as any).departments
    : [];

  let categoryFromNav: { id: number; name: string; slug: string } | null = null;
  let departmentFromNav: { id: number; name: string; slug: string } | null = null;

  for (const d of departments as any[]) {
    const cats = Array.isArray(d?.categories) ? d.categories : [];
    const found = cats.find((c: any) => c?.slug === slug);
    if (found) {
      categoryFromNav = {
        id: Number(found.id) || 0,
        name: String(found.name || ""),
        slug: String(found.slug || slug),
      };
      departmentFromNav = {
        id: Number(d?.id) || 0,
        name: String(d?.name || ""),
        slug: String(d?.slug || ""),
      };
      break;
    }
  }

  const categoryName =
    categoryFromProducts?.name ||
    categoryFromNav?.name ||
    slug;

  const departmentName =
    departmentFromProducts?.name ||
    departmentFromNav?.name ||
    "";

  return (
    <section className="page-shell page-shell--with-header">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <header className="page-intro max-w-3xl">
          {departmentName ? (
            <div className="page-eyebrow">{departmentName}</div>
          ) : null}

          <div className="page-title-block">
            <h1 className="page-title">{categoryName}</h1>
            <p className="page-subtitle">
              {count} producto{count !== 1 ? "s" : ""}
            </p>
          </div>
        </header>
      </div>

      <div className="page-content-start page-body mx-auto max-w-6xl px-4 pb-6 md:px-6 md:pb-10">
        {results.length === 0 ? (
          <p className="type-ui-label py-12 text-center text-zinc-500">
            No hay productos en esta categoría.
          </p>
        ) : (
          <>
            <ProductGrid
              className="px-0 md:px-0"
              products={results.map((product: Product) => ({
                ...product,
                sold_out: product.sold_out === true,
              }))}
            />

            {next && (
              <div className="mt-8 flex justify-center">
                <a
                  href={`${categoryPath(slug, deptSlug)}${categoryPath(slug, deptSlug).includes("?") ? "&" : "?"}page=${pageNum + 1}${
                    search ? `&search=${encodeURIComponent(search)}` : ""
                  }`}
                  className="btn-secondary rounded-xl px-4 py-2.5"
                >
                  Ver más
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}