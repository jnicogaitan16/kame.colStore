import { getCategories, getNavigation } from "@/lib/api";

import Header from "./Header";

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
        const categories = Array.isArray(department?.categories)
          ? department.categories.filter(
              (category: any) =>
                category &&
                String(category?.name || "").trim() &&
                String(category?.slug || "").trim()
            )
          : [];

        return {
          ...department,
          categories,
        };
      })
      .filter(
        (department: any) =>
          department &&
          String(department?.name || "").trim() &&
          String(department?.slug || "").trim() &&
          Array.isArray(department.categories) &&
          department.categories.length > 0
      );

    if (navDepartments.length === 0) {
      console.warn("[HeaderServer] navigation endpoint returned no usable departments; falling back to categories.");
      categories = await getCategories();
    }
  } catch (error) {
    console.warn("[HeaderServer] failed to load navigation; falling back to categories.", error);
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
