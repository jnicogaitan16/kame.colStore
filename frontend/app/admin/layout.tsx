"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authMe, authLogout } from "@/lib/admin-api";
import type { AdminUser } from "@/types/admin";

const NAV: { href: string; label: string; icon: string; indent?: boolean }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/admin/ordenes", label: "Órdenes", icon: "📦" },
  { href: "/admin/inventario", label: "Inventario", icon: "🗃" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/analytics", label: "Analítica", icon: "📈" },
  { href: "/admin/recuperacion", label: "Recuperación", icon: "⏳" },
  { href: "/admin/catalogo", label: "Catálogo", icon: "🛍" },
  { href: "/admin/catalogo/departamentos", label: "Departamentos", icon: "⌂", indent: true },
  { href: "/admin/catalogo/categorias", label: "Categorías", icon: "🏷", indent: true },
  { href: "/admin/catalogo/productos", label: "Productos", icon: "📦", indent: true },
  { href: "/admin/catalogo/homepage-banners", label: "Homepage banners", icon: "🖼", indent: true },
  { href: "/admin/catalogo/promos-home", label: "Promos de Home", icon: "✦", indent: true },
  { href: "/admin/catalogo/secciones-home", label: "Secciones de Home", icon: "¶", indent: true },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin/catalogo") {
    return pathname === "/admin/catalogo";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function headerTitleForPath(pathname: string): string {
  const sorted = [...NAV].sort((a, b) => b.href.length - a.href.length);
  const hit = sorted.find((item) => isNavItemActive(pathname, item.href));
  return hit?.label ?? "Admin";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setLoading(false);
      return;
    }
    authMe().then((u) => {
      if (!u) {
        router.replace("/admin/login");
      } else {
        setUser(u);
      }
      setLoading(false);
    });
  }, [pathname, router]);

  if (pathname === "/admin/login") return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  async function handleLogout() {
    await authLogout();
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-56 bg-white border-r border-zinc-200 z-30 flex flex-col
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        <div className="px-5 py-4 border-b border-zinc-200">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-red-500">kame</span>.col
          </span>
          <span className="text-zinc-400 text-xs ml-2">Admin</span>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 py-2.5 text-sm transition-colors
                  ${item.indent ? "pl-10 pr-5" : "px-5"}
                  ${active
                    ? "bg-red-50 text-red-600 font-medium border-r-2 border-red-500"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                  }
                `}
              >
                <span className={item.indent ? "text-xs" : "text-base"}>{item.icon}</span>
                <span className={item.indent ? "text-xs leading-snug" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-zinc-200">
          <p className="text-xs text-zinc-500 truncate">{user.username}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-400 hover:text-red-500 transition-colors mt-1"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-zinc-200 flex items-center px-3 sm:px-4 gap-2 bg-white sticky top-0 z-40 shadow-sm shrink-0">
          <button
            type="button"
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 -ml-0.5"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú de navegación"
          >
            <span className="text-xl leading-none" aria-hidden>
              ☰
            </span>
          </button>
          <span className="text-sm font-medium text-zinc-800 flex-1 truncate pr-2">
            {headerTitleForPath(pathname)}
          </span>
          <span className="text-xs text-zinc-400">
            {user.first_name || user.username}
          </span>
        </header>

        <main className="flex-1 min-w-0 overflow-auto p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
