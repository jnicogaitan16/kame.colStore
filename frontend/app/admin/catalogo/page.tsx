import Link from "next/link";

const SECTIONS: { href: string; title: string; desc: string; icon: string }[] = [
  {
    href: "/admin/inventario",
    title: "Inventario",
    desc: "Stock por categoría (pools): ajustes, carga masiva y sincronización con variantes.",
    icon: "🗃",
  },
  {
    href: "/admin/catalogo/departamentos",
    title: "Departamentos",
    desc: "Hombre, Mujer, Accesorios y orden de navegación.",
    icon: "⌂",
  },
  {
    href: "/admin/catalogo/categorias",
    title: "Categorías",
    desc: "Árbol de categorías, esquemas de variante y slugs.",
    icon: "🏷",
  },
  {
    href: "/admin/catalogo/productos",
    title: "Productos",
    desc: "Alta, edición, variantes y stock enlazado al inventario.",
    icon: "📦",
  },
  {
    href: "/admin/catalogo/homepage-banners",
    title: "Homepage banners",
    desc: "Carrusel principal del home (hero).",
    icon: "🖼",
  },
  {
    href: "/admin/catalogo/promos-home",
    title: "Promos de Home",
    desc: "Tarjetas Top / Mid en la página principal.",
    icon: "✦",
  },
  {
    href: "/admin/catalogo/secciones-home",
    title: "Secciones de Home",
    desc: "Bloques editoriales (texto largo, clave única).",
    icon: "¶",
  },
];

export default function CatalogoHubPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Catálogo</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Inventario, departamentos, categorías, productos y contenido del home desde este panel.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex gap-3 p-4 rounded-xl border border-zinc-200 bg-white hover:border-red-300 hover:bg-red-50/30 transition-colors group"
            >
              <span className="text-2xl shrink-0" aria-hidden>{s.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 group-hover:text-red-600 transition-colors">
                  {s.title}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
