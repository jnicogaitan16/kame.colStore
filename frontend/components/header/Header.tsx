"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type TouchEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Navbar, { NavbarNavDepartment } from "./Navbar";
import MiniCart from "@/components/cart/MiniCart";
import { categoryPath } from "@/lib/routes";
import { useCartStore } from "@/store/cart";

export type HeaderProps = {
  navDepartments?: NavbarNavDepartment[];
  categories?: NavbarCategory[];
  cartCount?: number;

  // Optional external control hooks (if parent wants to drive UI)
  onToggleCart?: () => void;
};

const MENU_DRAG_THRESHOLD_PX = 12;
const MENU_HORIZONTAL_DOMINANCE_RATIO = 1.2;
const MENU_CLOSE_THRESHOLD_RATIO = 0.32;
const MENU_FAST_SWIPE_VELOCITY = 0.55;

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
      const categoryId = String((category as any)?.id ?? "").trim() || normalizeSlug((category as any)?.slug);
      const categoryName = String((category as any)?.name || "").trim();
      const categorySlug = normalizeSlug((category as any)?.slug);
      const categorySortOrder = typeof (category as any)?.sort_order === "number" ? (category as any).sort_order : 0;

      if (!categorySlug || !categoryName) continue;

      const categoryKey = `${categorySlug}`;
      if (categorySeen.has(categoryKey)) continue;
      categorySeen.add(categoryKey);

      categories.push({
        id: categoryId,
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

    const deptSortOrder =
      typeof (departmentObj as any)?.sort_order === "number"
        ? (departmentObj as any).sort_order
        : 0;

    if (!deptMap.has(deptSlug)) {
      deptMap.set(deptSlug, {
        id: deptId as any,
        name: deptName,
        slug: deptSlug,
        sort_order: deptSortOrder,
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

  return Array.from(deptMap.values())
    .map((dept) => ({
      ...dept,
      categories: [...dept.categories].sort((a, b) => {
        const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
        const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
        if (ao !== bo) return ao - bo;
        return String(a.name || "").localeCompare(String(b.name || ""));
      }),
    }))
    .sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ChevronLeft({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M14.5 3c.35 1.82 1.41 3.2 3.5 3.54V9.1c-1.24-.04-2.37-.38-3.5-1.05v6.35c0 3.2-2.03 5.6-5.45 5.6-1.39 0-2.56-.43-3.5-1.18C4.48 17.93 4 16.63 4 15.2c0-3.12 2.3-5.51 5.65-5.51.3 0 .56.02.83.08v2.74a3.56 3.56 0 0 0-.8-.1c-1.78 0-2.92 1.25-2.92 2.76 0 1.62 1.17 2.73 2.71 2.73 1.62 0 2.51-1.03 2.51-3.2V3h2.52z" />
    </svg>
  );
}

function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.25-1.46 1.5-1.46H16.7V5a22.6 22.6 0 0 0-2.43-.12c-2.4 0-4.04 1.47-4.04 4.17V11H7.5v3h2.73v8h3.27z" />
    </svg>
  );
}

function MobileMenuContent({
  navDepartments,
  categories,
  onNavigate,
  isOpen,
}: {
  navDepartments?: NavbarNavDepartment[];
  categories?: NavbarCategory[];
  onNavigate: () => void;
  isOpen: boolean;
}) {
  const orderedDepts = useMemo(() => {
    const explicitDepartments = sanitizeNavDepartments(navDepartments)
      .filter((dept) => dept.categories.length > 0);

    const derivedDepartments = deriveNavDepartmentsFromCategories(categories)
      .filter((dept) => dept.categories.length > 0);

    const source = explicitDepartments.length > 0 ? explicitDepartments : derivedDepartments;

    return [...source].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [navDepartments, categories]);

  const [activeDeptSlug, setActiveDeptSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setActiveDeptSlug(null);
      return;
    }

    if (!orderedDepts.length) {
      setActiveDeptSlug(null);
      return;
    }

    if (activeDeptSlug && !orderedDepts.some((dept) => dept.slug === activeDeptSlug)) {
      setActiveDeptSlug(null);
    }
  }, [isOpen, orderedDepts, activeDeptSlug]);

  const activeDept = useMemo(() => {
    if (!orderedDepts.length || !activeDeptSlug) return undefined;
    return orderedDepts.find((d) => d.slug === activeDeptSlug);
  }, [orderedDepts, activeDeptSlug]);

  const deptCategories = useMemo(() => {
    if (!activeDept) return [];
    const raw = Array.isArray(activeDept.categories) ? activeDept.categories : [];
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

  const flatCategories = useMemo(() => {
    return sanitizeLegacyCategories(categories).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""))
    );
  }, [categories]);

  const showDeptNav = orderedDepts.length > 0;
  const showDepartmentCategories = showDeptNav && !!activeDept;

  const categoryHref = (slug: string) => categoryPath(slug, activeDept?.slug ?? undefined);

  const showList = showDeptNav ? deptCategories : flatCategories;

  const mobileMenuSocialLinks = [
    {
      label: "Instagram",
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
      Icon: InstagramIcon,
    },
    {
      label: "TikTok",
      href: process.env.NEXT_PUBLIC_TIKTOK_URL,
      Icon: TikTokIcon,
    },
    {
      label: "Facebook",
      href: process.env.NEXT_PUBLIC_FACEBOOK_URL,
      Icon: FacebookIcon,
    },
  ].filter((item) => Boolean(item.href));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showDeptNav ? (
        <>
          {showDepartmentCategories ? (
            <div className="border-b border-white/10 px-4 pb-4 pt-2">
              <div className="flex items-center gap-3 text-white">
                <button
                  type="button"
                  onClick={() => setActiveDeptSlug(null)}
                  className="inline-flex h-9 w-9 items-center justify-center text-white/85 transition hover:text-white"
                  aria-label="Volver a departamentos"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="type-section-title text-white">
                  {String(activeDept?.name || "").toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b border-white/10 px-4 pb-4 pt-2" />
          )}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="flex h-full w-[200%] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: showDepartmentCategories ? "translateX(-50%)" : "translateX(0%)" }}
            >
              <div
                className={
                  "h-full w-1/2 overflow-y-auto px-4 pt-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
                  (showDepartmentCategories ? "opacity-70" : "opacity-100")
                }
              >
                <ul>
                  {orderedDepts.map((dept) => (
                    <li key={dept.slug}>
                      <button
                        type="button"
                        onClick={() => setActiveDeptSlug(dept.slug)}
                        className="type-secondary flex w-full items-center justify-between py-4 text-left text-white/92 transition hover:text-white"
                      >
                        <span>{dept.name}</span>
                        <ChevronRight className="h-5 w-5 text-white/40" />
                      </button>
                      <div className="h-px bg-white/10" />
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={
                  "h-full w-1/2 overflow-y-auto px-4 pt-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] " +
                  (showDepartmentCategories ? "opacity-100" : "opacity-70")
                }
              >
                <ul>
                  {showList.length > 0 ? (
                    showList.map((c) => (
                      <li key={String((c as any).id ?? (c as any).slug)}>
                        <Link
                          href={categoryHref((c as any).slug)}
                          onClick={onNavigate}
                          className="type-secondary flex items-center justify-between py-4 text-white/92 transition hover:text-white"
                        >
                          <span>{(c as any).name}</span>
                          <ChevronRight className="h-5 w-5 text-white/40" />
                        </Link>
                        <div className="h-px bg-white/10" />
                      </li>
                    ))
                  ) : (
                    <li className="type-secondary py-4 text-white/70">
                      No hay categorías disponibles en esta sección.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3">
          <ul>
            {showList.length > 0 ? (
              showList.map((c) => (
                <li key={String((c as any).id ?? (c as any).slug)}>
                  <Link
                    href={categoryHref((c as any).slug)}
                    onClick={onNavigate}
                    className="type-secondary flex items-center justify-between py-4 text-white/92"
                  >
                    <span>{(c as any).name}</span>
                    <ChevronRight className="h-5 w-5 text-white/40" />
                  </Link>
                  <div className="h-px bg-white/10" />
                </li>
              ))
            ) : (
              <li className="type-secondary py-4 text-white/70">Menú no disponible.</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-auto shrink-0 px-4 pb-6 pt-4">
        <div className="flex items-center justify-center gap-5">
          {mobileMenuSocialLinks.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={String(href)}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="inline-flex h-10 w-10 items-center justify-center text-white/58 transition duration-300 hover:scale-[1.06] hover:text-white"
            >
              <Icon className="h-[20px] w-[20px]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Header({
  navDepartments,
  categories,
  cartCount,
  onToggleCart,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const mobileMenuPanelRef = useRef<HTMLDivElement | null>(null);
  const [isMenuDragging, setIsMenuDragging] = useState(false);
  const [menuDragX, setMenuDragX] = useState(0);
  const [menuStartX, setMenuStartX] = useState(0);
  const [menuStartY, setMenuStartY] = useState(0);
  const [menuLockedAxis, setMenuLockedAxis] = useState<"x" | "y" | null>(null);
  const menuDragStartTimeRef = useRef(0);

  const pathname = usePathname();

  useEffect(() => {
    delete document.documentElement.dataset.routeLoading;
  }, [pathname]);

  const mobileMenuPanelWidth = mobileMenuPanelRef.current?.offsetWidth ?? 0;
  const clampedMenuDragX = Math.min(0, menuDragX);
  const menuDragDistance = Math.abs(clampedMenuDragX);
  const menuDragProgress = mobileMenuPanelWidth > 0 ? Math.min(menuDragDistance / mobileMenuPanelWidth, 1) : 0;
  const mobileMenuBackdropOpacity = mobileMenuOpen ? Math.max(0, 1 - menuDragProgress) : 0;
  const mobileMenuTranslateX = mobileMenuOpen
    ? isMenuDragging
      ? clampedMenuDragX
      : 0
    : -(mobileMenuPanelWidth || 0);

  function resetMobileMenuDragState() {
    setIsMenuDragging(false);
    setMenuDragX(0);
    setMenuStartX(0);
    setMenuStartY(0);
    setMenuLockedAxis(null);
    menuDragStartTimeRef.current = 0;
  }

  function handleMobileMenuTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!mobileMenuOpen) return;

    const interactiveTarget = (event.target as HTMLElement | null)?.closest(
      'a, button, input, select, textarea, [role="button"]'
    );
    if (interactiveTarget) {
      resetMobileMenuDragState();
      return;
    }

    const touch = event.touches[0];
    setMenuStartX(touch.clientX);
    setMenuStartY(touch.clientY);
    setMenuDragX(0);
    setMenuLockedAxis(null);
    setIsMenuDragging(false);
    menuDragStartTimeRef.current = performance.now();
  }

  function handleMobileMenuTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!mobileMenuOpen) return;

    const touch = event.touches[0];
    const nextDeltaX = touch.clientX - menuStartX;
    const nextDeltaY = touch.clientY - menuStartY;
    const absDeltaX = Math.abs(nextDeltaX);
    const absDeltaY = Math.abs(nextDeltaY);

    if (!menuLockedAxis) {
      if (absDeltaX < MENU_DRAG_THRESHOLD_PX && absDeltaY < MENU_DRAG_THRESHOLD_PX) {
        return;
      }

      if (absDeltaX > absDeltaY * MENU_HORIZONTAL_DOMINANCE_RATIO && nextDeltaX < 0) {
        setMenuLockedAxis("x");
        setIsMenuDragging(true);
      } else {
        setMenuLockedAxis("y");
        setIsMenuDragging(false);
        return;
      }
    }

    if (menuLockedAxis !== "x") {
      return;
    }

    event.preventDefault();
    setIsMenuDragging(true);
    setMenuDragX(Math.min(0, nextDeltaX));
  }

  function handleMobileMenuTouchEnd() {
    if (!mobileMenuOpen) {
      resetMobileMenuDragState();
      return;
    }

    if (menuLockedAxis !== "x") {
      resetMobileMenuDragState();
      return;
    }

    const elapsedMs = Math.max(performance.now() - menuDragStartTimeRef.current, 1);
    const velocity = menuDragDistance / elapsedMs;
    const shouldCloseByDistance =
      mobileMenuPanelWidth > 0 && menuDragDistance > mobileMenuPanelWidth * MENU_CLOSE_THRESHOLD_RATIO;
    const shouldCloseByVelocity = velocity > MENU_FAST_SWIPE_VELOCITY;

    if (shouldCloseByDistance || shouldCloseByVelocity) {
      resetMobileMenuDragState();
      setMobileMenuOpen(false);
      return;
    }

    resetMobileMenuDragState();
  }

  function handleMobileMenuTouchCancel() {
    resetMobileMenuDragState();
  }

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a) return;

      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      if (!a.href) return;

      const url = new URL(a.href);
      if (url.origin !== window.location.origin) return;

      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      document.documentElement.dataset.routeLoading = "1";
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  const storeCartCount = useCartStore((s) =>
    Array.isArray((s as any).items)
      ? (s as any).items.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0), 0)
      : 0
  );

  const effectiveCartCount = typeof cartCount === "number" ? Math.max(cartCount, storeCartCount) : storeCartCount;

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isCartOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isCartOpen) setIsCartOpen(false);
      else setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCartOpen]);

  const handleOpenMobileMenu = useMemo(() => {
    return () => setMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useMemo(() => {
    return () => {
      resetMobileMenuDragState();
      setMobileMenuOpen(false);
    };
  }, []);

  const handleToggleCart = useCallback(() => {
    if (typeof onToggleCart === "function") {
      onToggleCart();
      return;
    }
    setIsCartOpen(true);
  }, [onToggleCart]);

  const handleCloseCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <header className="fixed left-0 right-0 top-0 z-[80]">
      <div
        className={
          "w-full border-b transition-all duration-300 " +
          (isScrolled
            ? "border-white/10 bg-zinc-950/45 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150"
            : "border-transparent bg-black")
        }
        style={
          isScrolled
            ? {
                WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                backdropFilter: "blur(18px) saturate(1.4)",
              }
            : undefined
        }
      >
        <Navbar
          variant="nav"
          navDepartments={navDepartments}
          categories={categories}
          cartCount={effectiveCartCount}
          onOpenMobileMenu={handleOpenMobileMenu}
          onToggleCart={handleToggleCart}
        />
      </div>

      <div aria-hidden className="h-12 md:h-14" />

      {mobileMenuOpen ? (
        <div id="mobile-menu" className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            style={{ opacity: mobileMenuBackdropOpacity }}
            aria-label="Cerrar menú"
            onClick={handleCloseMobileMenu}
          />

          <div
            ref={mobileMenuPanelRef}
            className={[
              "absolute left-0 top-0 flex h-full w-[86%] max-w-[360px] flex-col drawer-glass border-r border-white/10",
              isMenuDragging ? "transition-none" : "transition-transform duration-300 ease-out",
            ].join(" ")}
            style={{ transform: `translateX(${mobileMenuTranslateX}px)` }}
            onTouchStart={handleMobileMenuTouchStart}
            onTouchMove={handleMobileMenuTouchMove}
            onTouchEnd={handleMobileMenuTouchEnd}
            onTouchCancel={handleMobileMenuTouchCancel}
          >
            <div className="flex min-h-[68px] items-center justify-center px-4 py-4">
              <div className="type-brand text-center text-white">Kame.col</div>
            </div>

            <div className="min-h-0 flex-1">
              <MobileMenuContent
                navDepartments={navDepartments}
                categories={categories}
                onNavigate={handleCloseMobileMenu}
                isOpen={mobileMenuOpen}
              />
            </div>
          </div>
        </div>
      ) : null}

      <MiniCart open={isCartOpen} onClose={handleCloseCart} />
    </header>
  );
}