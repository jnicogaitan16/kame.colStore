import { getCategories } from "@/lib/api";

import Header from "./Header";

export default async function HeaderServer() {
  const categories = await getCategories();

  return <Header categories={categories} />;
}
