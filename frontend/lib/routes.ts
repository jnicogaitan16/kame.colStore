// frontend/lib/routes.ts
// Única fuente de verdad para rutas internas del frontend.
// Evita hardcodear paths en múltiples componentes (causa típica de 404).

export function catalogPath() {
  return "/catalogo";
}

export function departmentCatalogPath(deptSlug: string) {
  const dept = encodeURIComponent(String(deptSlug || "").trim());
  return dept ? `${catalogPath()}?dept=${dept}` : catalogPath();
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

export function checkoutResultPath(reference: string, widgetStatus?: string) {
  const ref = encodeURIComponent(String(reference || "").trim());
  const base = `/checkout/resultado?ref=${ref}`;
  return widgetStatus ? `${base}&ws=${encodeURIComponent(widgetStatus)}` : base;
}