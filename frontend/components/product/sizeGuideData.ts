export type SizeGuideRow = {
  size: string;
  values: Array<string | number>;
};

export type SizeGuide = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: SizeGuideRow[];
};

export type SizeGuideKey = "oversize" | "hoodie";

/**
 * Centralized size guide data.
 *
 * Notes:
 * - Measurements are expected to be in cm (unless you decide otherwise).
 * - Update values here without touching UI components.
 */
export const sizeGuides: Record<SizeGuideKey, SizeGuide> = {
  oversize: {
    title: "Guía de tallas — Oversize",
    subtitle:
      "Medidas reales en centímetros (cm). Corte amplio, caída relajada y fit urbano. Puede variar ±1–2 cm según el lote.",
    columns: ["Talla", "Largo (cm)", "Ancho (cm)", "Manga (cm)"],
    rows: [
      { size: "S", values: [71, 50, 21] },
      { size: "M", values: [74, 55, 22] },
      { size: "L", values: [77, 60, 23] },
      { size: "XL", values: [80, 65, 24] },
      { size: "2XL", values: [83, 70, 25] },
    ],
  },

  hoodie: {
    title: "Guía de tallas — Hoodie",
    subtitle:
      "Medidas en centímetros (cm). Fit cómodo, estructura firme y estilo street. Puede variar ±1–2 cm según producción.",
    columns: ["Talla", "Largo (cm)", "Ancho (cm)", "Manga (cm)"],
    rows: [
      { size: "S", values: [68, 54, 62] },
      { size: "M", values: [70, 57, 63] },
      { size: "L", values: [72, 60, 64] },
      { size: "XL", values: [74, 63, 65] },
      { size: "2XL", values: [76, 66, 66] },
    ],
  },
};

export default sizeGuides;