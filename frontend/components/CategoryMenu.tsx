import Link from "next/link";
import { getCategories } from "@/lib/api";

type Props = {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void; // para cerrar el menú en mobile al hacer click
};

export default async function CategoryMenu({
  variant = "desktop",
  onNavigate,
}: Props) {
  const categories = await getCategories();

  const className =
    variant === "desktop"
      ? "flex items-center gap-6 text-sm font-medium"
      : "flex flex-col gap-4 text-base font-medium";

  return (
    <nav className={className} aria-label="Categorías">
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/categoria/${c.slug}`}
          // next/link permite onClick; esto lo usamos para cerrar el drawer en mobile
          onClick={onNavigate}
          className="hover:opacity-80"
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
