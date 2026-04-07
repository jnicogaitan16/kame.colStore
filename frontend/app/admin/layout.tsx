"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authMe, authLogout } from "@/lib/admin-api";
import type { AdminUser } from "@/types/admin";

const NAV = [
  { href: "/admin/dashboard",   label: "Dashboard",   icon: "▦" },
  { href: "/admin/ordenes",     label: "Órdenes",      icon: "📦" },
  { href: "/admin/inventario",  label: "Inventario",   icon: "🗃" },
  { href: "/admin/clientes",    label: "Clientes",     icon: "👥" },
  { href: "/admin/analytics",   label: "Analítica",    icon: "📈" },
  { href: "/admin/recuperacion",label: "Recuperación", icon: "⏳" },
  { href: "/admin/catalogo",    label: "Catálogo",     icon: "🛍" },
];

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-sm">Cargando...</div>
      </div>
    );
  }
  if (!user) return null;

  async function handleLogout() {
    await authLogout();
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-56 bg-[#111] border-r border-white/10 z-30 flex flex-col
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10">
          <span className="font-bold text-lg tracking-tight">
            <span className="text-[#e63946]">kame</span>.col
          </span>
          <span className="text-white/40 text-xs ml-2">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                  ${active
                    ? "bg-[#e63946]/10 text-[#e63946] font-medium"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-white/40 truncate">{user.username}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-white/40 hover:text-[#e63946] transition-colors mt-1"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-white/10 flex items-center px-4 gap-3 bg-[#0a0a0a] sticky top-0 z-10">
          <button
            className="md:hidden text-white/60 hover:text-white p-1"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className="text-sm text-white/40 flex-1">
            {NAV.find((n) => pathname.startsWith(n.href))?.label || "Admin"}
          </span>
          <span className="text-xs text-white/30">
            {user.first_name || user.username}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
