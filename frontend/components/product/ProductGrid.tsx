import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: any[];
  className?: string;
  emptyState?: React.ReactNode;
}

const PRODUCT_GRID_SECTION_CLASS = "relative w-full px-4 md:px-6";
const PRODUCT_GRID_INNER_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 xl:grid-cols-4 xl:gap-x-6 xl:gap-y-12";

export function ProductGrid({
  products,
  className = "",
  emptyState = null,
}: ProductGridProps) {
  if (!Array.isArray(products) || products.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <section
      className={[PRODUCT_GRID_SECTION_CLASS, className].filter(Boolean).join(" ")}
      data-layout="product-grid"
    >
      <div className={PRODUCT_GRID_INNER_CLASS}>
        {products.map((product) => {
          const key = String(
            product?.id ?? product?.slug ?? `${product?.name ?? "product"}-${product?.price ?? "0"}`
          );

          return <ProductCard key={key} product={product} />;
        })}
      </div>
    </section>
  );
}

export default ProductGrid;