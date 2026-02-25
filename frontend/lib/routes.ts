// frontend/lib/routes.ts
// Única fuente de verdad para rutas internas del frontend.
// Evita hardcodear paths en múltiples componentes (causa típica de 404).

export const categoryPath = (slug: string, dept?: string) =>
  dept
    ? `/categoria/${slug}?dept=${encodeURIComponent(dept)}`
    : `/categoria/${slug}`;

export function productPath(slug: string) {
  const s = encodeURIComponent(String(slug || "").trim());
  return `/producto/${s}`;
}