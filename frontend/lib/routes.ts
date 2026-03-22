// frontend/lib/routes.ts
// Única fuente de verdad para rutas internas del frontend.
// Evita hardcodear paths en múltiples componentes (causa típica de 404).

export function catalogPath() {
  return "/catalogo";
}

export const categoryPath = (slug: string, dept?: string) => {
  const s = encodeURIComponent(String(slug || "").trim());

  return dept
    ? `/categoria/${s}?dept=${encodeURIComponent(dept)}`
    : `/categoria/${s}`;
};

export function productPath(slug: string) {
  const s = encodeURIComponent(String(slug || "").trim());
  return `/producto/${s}`;
}