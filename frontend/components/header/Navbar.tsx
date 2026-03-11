"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { categoryPath } from "@/lib/routes";

export type NavbarCategory = {
  id: number | string;
  name: string;
  slug: string;
  department_slug?: string | null;
  department_name?: string | null;
  department?: {
    id?: number | string;
    name?: string | null;
    slug?: string | null;
  } | null;
};

export type NavbarNavDepartment = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
  categories: Array<{ id: number | string; name: string; slug: string; sort_order?: number }>;
};

export type NavbarProps = {
  /** Preferred: navigation departments (from GET /api/navigation/) */
  navDepartments?: NavbarNavDepartment[];
  /** Legacy fallback: flat categories */
  categories?: NavbarCategory[];
  onOpenMobileMenu?: () => void;
  onToggleCart?: () => void;
  cartCount: number;
  variant?: "overlay" | "nav";
};

function normalizeSlug(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function sanitizeNavDepartments(input: NavbarNavDepartment[] | undefined): NavbarNavDepartment[] {
  if (!Array.isArray(input)) return [];

  const deptSeen = new Set<string>();
  const sanitized: NavbarNavDepartment[] = [];

  for (const dept of input) {
    const deptId = Number((dept as any)?.id) || 0;
    const deptName = String((dept as any)?.name || "").trim();
    const deptSlug = normalizeSlug((dept as any)?.slug);
    const deptSortOrder = typeof (dept as any)?.sort_order === "number" ? (dept as any).sort_order : 0;

    if (!deptId || !deptSlug || !deptName) continue;

    const deptKey = `${deptId}__${deptSlug}`;
    if (deptSeen.has(deptKey)) continue;
    deptSeen.add(deptKey);

    const categorySeen = new Set<string>();
    const rawCategories = Array.isArray((dept as any)?.categories) ? (dept as any).categories : [];
    const categories: NavbarNavDepartment["categories"] = [];

    for (const category of rawCategories) {
      const categoryId = String((category as any)?.id ?? "").trim();
      const categoryName = String((category as any)?.name || "").trim();
      const categorySlug = normalizeSlug((category as any)?.slug);
      const categorySortOrder = typeof (category as any)?.sort_order === "number" ? (category as any).sort_order : 0;

      if (!categorySlug || !categoryName) continue;

      const categoryKey = `${categorySlug}`;
      if (categorySeen.has(categoryKey)) continue;
      categorySeen.add(categoryKey);

      categories.push({
        id: categoryId || categorySlug,
        name: categoryName,
        slug: categorySlug,
        sort_order: categorySortOrder,
      });
    }

    sanitized.push({
      id: deptId,
      name: deptName,
      slug: deptSlug,
      sort_order: deptSortOrder,
      categories,
    });
  }

  return sanitized;
}

function sanitizeLegacyCategories(input: NavbarCategory[] | undefined): NavbarCategory[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const sanitized: NavbarCategory[] = [];

  for (const category of input) {
    const name = String((category as any)?.name || "").trim();
    const slug = normalizeSlug((category as any)?.slug);
    const id = String((category as any)?.id ?? "").trim() || slug;

    if (!name || !slug) continue;

    const key = `${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sanitized.push({
      id,
      name,
      slug,
      department_slug: category.department_slug,
      department_name: category.department_name,
      department: category.department,
    });
  }

  return sanitized;
}

function deriveNavDepartmentsFromCategories(input: NavbarCategory[] | undefined): NavbarNavDepartment[] {
  if (!Array.isArray(input)) return [];

  const deptMap = new Map<string, NavbarNavDepartment>();

  for (const rawCategory of input) {
    const categoryName = String((rawCategory as any)?.name || "").trim();
    const categorySlug = normalizeSlug((rawCategory as any)?.slug);
    if (!categoryName || !categorySlug) continue;

    const departmentObj = (rawCategory as any)?.department || null;
    const deptSlug = normalizeSlug(
      departmentObj?.slug ??
      (rawCategory as any)?.department_slug ??
      ""
    );
    const deptName = String(
      departmentObj?.name ??
      (rawCategory as any)?.department_name ??
      ""
    ).trim();
    const deptIdRaw = departmentObj?.id ?? deptSlug;
    const deptId = Number(deptIdRaw) || String(deptIdRaw || "").trim();

    if (!deptSlug || !deptName || !deptId) continue;

    if (!deptMap.has(deptSlug)) {
      deptMap.set(deptSlug, {
        id: deptId as any,
        name: deptName,
        slug: deptSlug,
        sort_order: 0,
        categories: [],
      });
    }

    const dept = deptMap.get(deptSlug)!;
    const alreadyExists = dept.categories.some((category) => normalizeSlug(category.slug) === categorySlug);
    if (alreadyExists) continue;

    dept.categories.push({
      id: String((rawCategory as any)?.id ?? "").trim() || categorySlug,
      name: categoryName,
      slug: categorySlug,
      sort_order: 0,
    });
  }

  const preferredOrder = ["mujer", "hombre", "accesorios"];

  return Array.from(deptMap.values())
    .map((dept) => ({
      ...dept,
      categories: [...dept.categories].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    }))
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a.slug);
      const bi = preferredOrder.indexOf(b.slug);
      const av = ai === -1 ? 999 : ai;
      const bv = bi === -1 ? 999 : bi;
      if (av !== bv) return av - bv;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8V7a5 5 0 0 1 10 0v1" />
      <path d="M6 8h12l-1 13H7L6 8Z" />
    </svg>
  );
}

function DesktopDeptTabs({
  orderedDepts,
  initialSlug,
  categoryHref,
}: {
  orderedDepts: NavbarNavDepartment[];
  initialSlug: string;
  categoryHref: (slug: string, dept?: string) => string;
}) {
  const [activeDeptSlug, setActiveDeptSlug] = useState<string>(initialSlug);
  const [open, setOpen] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = (delayMs = 160) => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, delayMs);
  };

  useEffect(() => {
    if (!orderedDepts.length) return;

    const hasActive = orderedDepts.some((dept) => dept.slug === activeDeptSlug);
    if (!hasActive && initialSlug) {
      setActiveDeptSlug(initialSlug);
    }
  }, [initialSlug, activeDeptSlug, orderedDepts]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  const activeDept = orderedDepts.find((d) => d.slug === activeDeptSlug) || orderedDepts[0];

  const cats = useMemo(() => {
    const raw = Array.isArray(activeDept?.categories) ? activeDept.categories : [];
    const seen = new Set<string>();

    return [...raw]
      .filter((category) => {
        const slug = normalizeSlug(category?.slug);
        const name = String(category?.name || "").trim();
        if (!slug || !name) return false;
        if (seen.has(slug)) return false;
        seen.add(slug);
        return true;
      })
      .sort((a, b) => {
        const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
        const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
        if (ao !== bo) return ao - bo;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [activeDept]);

  return (
    <div
      className="relative pb-2"
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseMove={() => {
        // If the user crosses the buffer area, keep it open.
        clearCloseTimer();
      }}
      onMouseLeave={() => {
        // Delay close to allow crossing into the dropdown
        scheduleClose(260);
      }}
      onBlur={(e) => {
        // Close only when focus leaves the whole component
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          clearCloseTimer();
          setOpen(false);
        }
      }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-7 font-ui xl:gap-8">
        {orderedDepts.map((d) => {
          const isActive = d.slug === activeDeptSlug;
          return (
            <button
              key={d.slug}
              type="button"
              onMouseEnter={() => {
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              onFocus={() => {
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              onClick={() => {
                // Keep click for accessibility / touch devices
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              className={`type-brand transition ${isActive ? "text-white/96" : "text-white/66 hover:text-white/90"}`}
              aria-pressed={isActive}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Dropdown */}
      {open ? (
        <div
          className="absolute left-0 top-full z-[90] w-72 rounded-2xl border border-white/10 bg-zinc-950/80 p-2 shadow-xl backdrop-blur-xl"
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={() => {
            scheduleClose();
          }}
        >
          <div className="type-ui-label px-3 pb-2 pt-2 text-white/56">
            {activeDept?.name}
          </div>
          <ul className="max-h-[65vh] overflow-auto py-1">
            {cats.length > 0 ? (
              cats.map((c) => (
                <li key={String(c.id ?? c.slug)}>
                  <Link
                    href={categoryHref(c.slug, activeDeptSlug)}
                    className="type-card-title block rounded-xl px-3 py-2 text-white/88 transition hover:bg-white/5 hover:text-white"
                  >
                    {c.name}
                  </Link>
                </li>
              ))
            ) : (
              <li className="type-ui-label px-3 py-3 text-white/60">Menú no disponible.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar({
  variant = "nav",
  navDepartments,
  categories = [],
  onOpenMobileMenu = () => {},
  onToggleCart = () => {},
  cartCount,
}: NavbarProps) {
  // Única fuente de verdad de rutas
  const categoryHref = (slug: string, dept?: string) => categoryPath(slug, dept);

  const isOverlay = variant === "overlay";

  const rootText = isOverlay ? "text-white" : "text-zinc-100";

  const iconBtnClass =
    "md:hidden relative z-50 pointer-events-auto inline-flex h-9 w-9 items-center justify-center text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 leading-none";

  const desktopNavClass = isOverlay
    ? "hidden md:flex items-center gap-6 pr-4 text-white/85"
    : "hidden md:flex items-center gap-6 pr-4 text-white/80";

  const linkClass = isOverlay ? "hover:text-white/90" : "hover:text-zinc-200";

  const brandClass = "type-brand justify-self-center text-white/94 tracking-[0.12em]";

  const cartBtnClass = isOverlay
    ? "relative rounded-lg p-1.5 text-white/90 transition hover:bg-white/10 hover:text-white leading-none"
    : "relative rounded-lg p-1.5 text-white/80 transition hover:bg-white/5 hover:text-white leading-none";

  const orderedDepts = useMemo(() => {
    return sanitizeNavDepartments(navDepartments)
      .filter((dept) => dept.categories.length > 0)
      .sort((a, b) => {
        const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
        const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name);
      });
  }, [navDepartments]);

  const orderedLegacyCategories = useMemo(() => {
    return sanitizeLegacyCategories(categories).slice(0, 6);
  }, [categories]);

  const initialSlug =
    orderedDepts.find((d) => d.slug === "mujer")?.slug ||
    orderedDepts.find((d) => d.slug === "hombre")?.slug ||
    orderedDepts[0]?.slug ||
    "";

  return (
    <div
      className={`mx-auto grid h-12 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-14 ${rootText}`}
    >
      {/* Left: hamburger + desktop categories */}
      <div className="flex items-center justify-self-start">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onOpenMobileMenu === "function") onOpenMobileMenu();
          }}
          className={iconBtnClass}
          aria-label="Abrir menú"
          aria-controls="mobile-menu"
          data-testid="mobile-menu-button"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <nav className={desktopNavClass} aria-label="Categorías">
          {orderedDepts.length > 0 ? (
            <DesktopDeptTabs orderedDepts={orderedDepts} initialSlug={initialSlug} categoryHref={categoryHref} />
          ) : (
            orderedLegacyCategories.map((c) => (
              <Link key={String(c.id ?? c.slug)} href={categoryHref(c.slug)} className={linkClass}>
                {c.name}
              </Link>
            ))
          )}
        </nav>
      </div>

      {/* Center: brand */}
      <Link href="/" className={brandClass} aria-label="Ir al inicio">
        Kame.col
      </Link>

      {/* Right: cart */}
      <div className="flex items-center gap-3 justify-self-end">
        <button
          type="button"
          onClick={() => {
            if (typeof onToggleCart === "function") onToggleCart();
          }}
          className={cartBtnClass}
          aria-label="Ver carrito"
        >
          <BagIcon className="h-6 w-6" />
          {cartCount > 0 && (
            <span
              className="type-ui-label absolute right-1 top-1 z-10 select-none text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.85)]"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)" }}
              aria-label={`Productos en el carrito: ${cartCount > 99 ? "99+" : cartCount}`}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
