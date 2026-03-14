

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type {
  NormalizedNavCategory,
  NormalizedNavDepartment,
} from "../../lib/navigation-normalize";
import { categoryPath } from "@/lib/routes";

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

const MOBILE_MENU_SOCIAL_LINKS = [
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

type MobileMenuContentProps = {
  navDepartments?: NormalizedNavDepartment[];
  categories?: NormalizedNavCategory[];
  onNavigate: () => void;
  isOpen: boolean;
};

export default function MobileMenuContent({
  navDepartments,
  categories,
  onNavigate,
  isOpen,
}: MobileMenuContentProps) {
  const orderedDepts = Array.isArray(navDepartments)
    ? navDepartments.filter((dept) => Array.isArray(dept.categories) && dept.categories.length > 0)
    : [];

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

  const activeDept =
    orderedDepts.length > 0 && activeDeptSlug
      ? orderedDepts.find((department) => department.slug === activeDeptSlug)
      : undefined;

  const deptCategories = activeDept?.categories ?? [];
  const flatCategories = Array.isArray(categories) ? categories : [];
  const showDeptNav = orderedDepts.length > 0;
  const showDepartmentCategories = showDeptNav && !!activeDept;
  const categoryHref = (slug: string) => categoryPath(slug, activeDept?.slug);
  const showList = showDeptNav ? deptCategories : flatCategories;

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
                <div className="type-brand text-white/92">
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
                        className="type-card-title flex w-full items-center justify-between py-4 text-left text-white/90 transition hover:text-white"
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
                      <li key={String(c.id ?? c.slug)}>
                        <Link
                          href={categoryHref(c.slug)}
                          onClick={onNavigate}
                          className="type-card-title flex items-center justify-between py-4 text-white/90 transition hover:text-white"
                        >
                          <span>{c.name}</span>
                          <ChevronRight className="h-5 w-5 text-white/40" />
                        </Link>
                        <div className="h-px bg-white/10" />
                      </li>
                    ))
                  ) : (
                    <li className="type-ui-label py-4 text-white/62">
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
                <li key={String(c.id ?? c.slug)}>
                  <Link
                    href={categoryHref(c.slug)}
                    onClick={onNavigate}
                    className="type-card-title flex items-center justify-between py-4 text-white/90 transition hover:text-white"
                  >
                    <span>{c.name}</span>
                    <ChevronRight className="h-5 w-5 text-white/40" />
                  </Link>
                  <div className="h-px bg-white/10" />
                </li>
              ))
            ) : (
              <li className="type-ui-label py-4 text-white/62">Menú no disponible.</li>
            )}
          </ul>
        </div>
      )}

      <div className="drawer-glass-footer mt-auto shrink-0 px-4 pb-6 pt-4">
        <div className="flex items-center justify-center gap-5">
          {MOBILE_MENU_SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={String(href)}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className="inline-flex h-10 w-10 items-center justify-center text-white/52 transition duration-300 hover:scale-[1.06] hover:text-white"
            >
              <Icon className="h-[20px] w-[20px]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}