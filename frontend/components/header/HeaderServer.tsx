import { getCategories, getNavigation } from "@/lib/api";

import Header from "./Header";

export default async function HeaderServer() {
  const categories = await getCategories();

  let navDepartments: any[] = [];

  try {
    const navigation = await getNavigation();
    navDepartments = navigation.departments;
  } catch (error) {
    // Optional fallback to categories if navigation endpoint fails
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
