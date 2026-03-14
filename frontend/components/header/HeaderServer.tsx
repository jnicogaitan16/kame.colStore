import { getCategories, getNavigation } from "@/lib/api";
import { resolveNavigation } from "../../lib/navigation-normalize";

import Header from "./Header";

export default async function HeaderServer() {
  let rawNavigation: Awaited<ReturnType<typeof getNavigation>> | null = null;
  let rawCategories: Awaited<ReturnType<typeof getCategories>> = [];

  try {
    rawNavigation = await getNavigation();
  } catch (error) {
    console.warn(
      "[HeaderServer] failed to load structured navigation; falling back to legacy categories.",
      error
    );
  }

  const initialResolved = resolveNavigation({ navigation: rawNavigation });

  if (!initialResolved.hasStructuredNavigation) {
    try {
      rawCategories = await getCategories();
    } catch (error) {
      console.warn(
        "[HeaderServer] failed to load legacy category fallback.",
        error
      );
    }
  }

  const resolved = resolveNavigation({
    navigation: rawNavigation,
    categories: rawCategories,
  });

  if (!resolved.hasStructuredNavigation && resolved.usedFallback) {
    console.warn("[HeaderServer] using legacy category fallback for header navigation.");
  }

  if (
    resolved.hasStructuredNavigation &&
    resolved.navDepartments.length > 0 &&
    !resolved.navDepartments.some(
      (department) => Array.isArray(department.categories) && department.categories.length > 0
    )
  ) {
    console.warn(
      "[HeaderServer] structured navigation loaded without usable categories; header may render department-only navigation."
    );
  }

  return (
    <Header
      categories={resolved.legacyCategories}
      navDepartments={resolved.navDepartments}
      cartCount={0}
    />
  );
}
