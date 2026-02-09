

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; slug: string };

type Props = {
  onNavigate?: () => void;
};

export default function CategoryMenuClient({ onNavigate }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
    if (!apiBase) {
      setCategories([]);
      return;
    }

    fetch(`${apiBase}/categories/`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  return (
    <nav
      className="flex flex-col gap-4 text-base font-medium"
      aria-label="Categorías"
    >
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/categoria/${c.slug}`}
          onClick={onNavigate}
          className="hover:opacity-80"
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}