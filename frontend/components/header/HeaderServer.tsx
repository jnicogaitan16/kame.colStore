import { getCategories } from "@/lib/api";

import Header from "./Header";

export default async function HeaderServer() {
  const categories = await getCategories();

  let navDepartments: any[] = [];

  try {
    const res = await fetch(
      `${process.env.DJANGO_API_BASE}/api/navigation/`,
      {
        cache: "no-store",
      }
    );

    if (res.ok) {
      navDepartments = await res.json();
    }
  } catch (error) {
    // Silent fallback to categories if navigation endpoint fails
    navDepartments = [];
  }

  return (
    <Header
      categories={categories}
      navDepartments={navDepartments}
      cartCount={0}
    />
  );
}
