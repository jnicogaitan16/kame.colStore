import { getCategories, getNavigation } from "@/lib/api";

import Header from "./Header";

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

export default async function HeaderServer() {
  let categories: any[] = [];
  let navDepartments: any[] = [];

  try {
    const navigation = await getNavigation();
    const rawDepartments = Array.isArray(navigation?.departments)
      ? navigation.departments
      : [];

    navDepartments = rawDepartments
      .map((department: any) => {
        const departmentId = Number(department?.id) || 0;
        const departmentName = normalizeText(department?.name);
        const departmentSlug = normalizeText(department?.slug);
        const departmentSortOrder =
          typeof department?.sort_order === "number" ? department.sort_order : 0;

        const categories = Array.isArray(department?.categories)
          ? department.categories
              .map((category: any) => ({
                ...category,
                id: String(category?.id ?? "").trim() || normalizeText(category?.slug),
                name: normalizeText(category?.name),
                slug: normalizeText(category?.slug),
                sort_order:
                  typeof category?.sort_order === "number" ? category.sort_order : 0,
              }))
              .filter(
                (category: any) =>
                  category &&
                  String(category?.name || "").trim() &&
                  String(category?.slug || "").trim()
              )
          : [];

        return {
          ...department,
          id: departmentId,
          name: departmentName,
          slug: departmentSlug,
          sort_order: departmentSortOrder,
          categories,
        };
      })
      .filter(
        (department: any) =>
          department &&
          Number(department?.id) > 0 &&
          String(department?.name || "").trim() &&
          String(department?.slug || "").trim()
      );

    const hasAnyDepartment = navDepartments.length > 0;
    const hasAnyDepartmentWithCategories = navDepartments.some(
      (department: any) =>
        Array.isArray(department?.categories) && department.categories.length > 0
    );

    if (rawDepartments.length === 0) {
      console.warn(
        "[HeaderServer] navigation endpoint returned no departments; enabling flat category fallback only."
      );
      categories = await getCategories();
    } else if (!hasAnyDepartment) {
      console.warn(
        "[HeaderServer] navigation endpoint returned departments, but none passed sanitization.",
        rawDepartments
      );
      categories = await getCategories();
    } else if (!hasAnyDepartmentWithCategories) {
      console.warn(
        "[HeaderServer] navigation endpoint returned departments without usable categories; preserving departments and enabling flat category fallback only.",
        rawDepartments
      );
      categories = await getCategories();
    }
  } catch (error) {
    console.warn(
      "[HeaderServer] failed to load navigation; enabling flat category fallback only.",
      error
    );
    categories = await getCategories();
  }

  return (
    <Header
      categories={categories}
      navDepartments={navDepartments}
      cartCount={0}
    />
  );
}
