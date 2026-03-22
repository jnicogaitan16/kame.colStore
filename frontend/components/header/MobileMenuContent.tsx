"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type {
  NormalizedNavCategory,
  NormalizedNavDepartment,
} from "../../lib/navigation-normalize";
import { categoryPath } from "@/lib/routes";
import { buildStoreWhatsAppUrl } from "@/lib/whatsapp";
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
} from "@/components/ui/social-icons";

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

const MOBILE_MENU_SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
    Icon: InstagramIcon,
    iconClassName: "h-[18px] w-[18px]",
  },
  {
    label: "TikTok",
    href: process.env.NEXT_PUBLIC_TIKTOK_URL,
    Icon: TikTokIcon,
    iconClassName: "h-[17px] w-[17px]",
  },
  {
    label: "Facebook",
    href: process.env.NEXT_PUBLIC_FACEBOOK_URL,
    Icon: FacebookIcon,
    iconClassName: "h-[17px] w-[17px]",
  },
  {
    label: "WhatsApp",
    href: buildStoreWhatsAppUrl("Hola, quiero información sobre productos de Kame.col."),
    Icon: WhatsAppIcon,
    iconClassName: "h-[18px] w-[18px]",
  },
].filter((item) => Boolean(item.href));

type MobileMenuContentProps = {
  navDepartments?: NormalizedNavDepartment[];
  categories?: NormalizedNavCategory[];
  onNavigate: () => void;
  isOpen: boolean;
  variant?: "overlay-home" | "overlay-pdp" | "solid-internal";
};

export default function MobileMenuContent({
  navDepartments,
  categories,
  onNavigate,
  isOpen,
  variant = "solid-internal",
}: MobileMenuContentProps) {
  const orderedDepts = useMemo(() => {
    return Array.isArray(navDepartments)
      ? navDepartments.filter(
          (dept) => Array.isArray(dept.categories) && dept.categories.length > 0
        )
      : [];
  }, [navDepartments]);

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

  const isOverlay = variant === "overlay-home" || variant === "overlay-pdp";

  const drawerRootClass =
    "flex h-full min-h-0 flex-col overflow-hidden bg-white/94 text-zinc-900 backdrop-blur-xl supports-[backdrop-filter]:bg-white/86";

  const drawerHeaderClass =
    "px-4 pb-4 pt-3 bg-white/72 backdrop-blur-md supports-[backdrop-filter]:bg-white/66";

  const drawerTitleClass = "type-brand text-zinc-950 transition-colors duration-200";

  const backButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors duration-200 hover:bg-zinc-900/4 hover:text-zinc-950";

  const primaryListPaneClass =
    "h-full min-h-0 w-1/2 overflow-y-auto overscroll-y-contain px-4 pt-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

  const secondaryListPaneClass =
    "h-full min-h-0 w-1/2 overflow-y-auto overscroll-y-contain px-4 pt-3 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

  const listButtonClass =
    "type-card-title flex w-full items-center justify-between rounded-xl py-4 text-left text-zinc-800 transition-colors duration-200 hover:bg-zinc-900/[0.03] hover:text-zinc-950";

  const listLinkClass =
    "type-card-title flex items-center justify-between rounded-xl py-4 text-zinc-800 transition-colors duration-200 hover:bg-zinc-900/[0.03] hover:text-zinc-950";

  // Removed dividerClass line as per instructions

  const emptyStateClass = "type-ui-label py-4 text-zinc-600";

  const socialLinkClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-900/8 bg-white text-zinc-600 transition duration-300 hover:scale-[1.02] hover:border-zinc-900/12 hover:bg-white hover:text-zinc-950";

  return (
    <div
      className={drawerRootClass}
      data-appearance={variant}
      data-overlay-origin={isOverlay ? "true" : "false"}
    >
      {showDeptNav ? (
        <>
          {showDepartmentCategories ? (
            <div className={drawerHeaderClass}>
              <div className="flex items-center gap-3 text-zinc-900">
                <button
                  type="button"
                  onClick={() => setActiveDeptSlug(null)}
                  className={backButtonClass}
                  aria-label="Volver a departamentos"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className={drawerTitleClass}>
                  {String(activeDept?.name || "").toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div className={drawerHeaderClass} />
          )}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="flex h-full w-[200%] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: showDepartmentCategories ? "translateX(-50%)" : "translateX(0%)" }}
            >
              <div
                className={
                  `${primaryListPaneClass} ` +
                  (showDepartmentCategories ? "opacity-52" : "opacity-100")
                }
              >
                <ul>
                  {orderedDepts.map((dept) => (
                    <li key={dept.slug}>
                      <button
                        type="button"
                        onClick={() => setActiveDeptSlug(dept.slug)}
                        className={listButtonClass}
                      >
                        <span>{dept.name}</span>
                        <ChevronRight className="h-5 w-5 text-zinc-300 transition-colors duration-200" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={
                  `${secondaryListPaneClass} ` +
                  (showDepartmentCategories ? "opacity-100" : "opacity-62")
                }
              >
                <ul>
                  {showList.length > 0 ? (
                    showList.map((c) => (
                      <li key={String(c.id ?? c.slug)}>
                        <Link
                          href={categoryHref(c.slug)}
                          onClick={onNavigate}
                          className={listLinkClass}
                        >
                          <span>{c.name}</span>
                          <ChevronRight className="h-5 w-5 text-zinc-300 transition-colors duration-200" />
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className={emptyStateClass}>
                      No hay categorías disponibles en esta sección.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-6 pt-3">
          <ul>
            {showList.length > 0 ? (
              showList.map((c) => (
                <li key={String(c.id ?? c.slug)}>
                  <Link
                    href={categoryHref(c.slug)}
                    onClick={onNavigate}
                    className={listLinkClass}
                  >
                    <span>{c.name}</span>
                    <ChevronRight className="h-5 w-5 text-zinc-300 transition-colors duration-200" />
                  </Link>
                </li>
              ))
            ) : (
              <li className={emptyStateClass}>Menú no disponible.</li>
            )}
          </ul>
        </div>
      )}

      <div className="drawer-glass-footer mt-auto shrink-0 px-4 pb-6 pt-4.5">
        <div className="flex items-center justify-center gap-3.5">
          {MOBILE_MENU_SOCIAL_LINKS.map(({ label, href, Icon, iconClassName }) => (
            <Link
              key={label}
              href={String(href)}
              target="_blank"
              rel="noreferrer"
              aria-label={label}
              className={socialLinkClass}
            >
              <Icon className={iconClassName} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}