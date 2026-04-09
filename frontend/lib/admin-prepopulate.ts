/**
 * Alineado con staticfiles/admin/js/prepopulate.js:
 * - Los campos fuente disparan populate en "keyup", "change" y "focus".
 * - El campo destino (slug) marca _changed en "change" si el usuario lo edita (slugTouchedRef en React).
 *
 * En inputs controlados de React, onChange ya cubre la mayoría de entradas; añadimos onKeyUp y onFocus
 * para igualar la semántica de Django (p. ej. foco en el nombre sin disparar change previo).
 */

export const SLUG_MAX = {
  category: 140,
  department: 140,
  product: 220,
  sectionKey: 60,
} as const;

/** Aproxima slugify + recorte como URLify(maxLength) en el admin de Django. */
export function adminUrlify(raw: string, maxLength: number, emptyFallback: string): string {
  let s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) s = emptyFallback;
  if (s.length > maxLength) {
    s = s.slice(0, maxLength).replace(/-+$/g, "");
  }
  return s;
}
