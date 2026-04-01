

export type NormalizedNavCategory = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  department_slug?: string;
  department_name?: string;
  department_sort_order?: number;
};

export type NormalizedNavDepartment = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  categories: NormalizedNavCategory[];
};

export type ResolvedNavigation = {
  navDepartments: NormalizedNavDepartment[];
  legacyCategories: NormalizedNavCategory[];
  usedFallback: boolean;
  hasStructuredNavigation: boolean;
};

type UnknownRecord = Record<string, unknown>;

type ResolveNavigationInput = {
  navigation?: unknown;
  categories?: unknown;
};

const PREFERRED_DEPARTMENT_ORDER = ["mujer", "hombre", "accesorios"] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeSlug(value: unknown): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSortOrder(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function compareByPreferredDepartmentOrder(
  a: Pick<NormalizedNavDepartment, "slug" | "sort_order" | "name">,
  b: Pick<NormalizedNavDepartment, "slug" | "sort_order" | "name">,
): number {
  const aIndex = PREFERRED_DEPARTMENT_ORDER.indexOf(
    a.slug as (typeof PREFERRED_DEPARTMENT_ORDER)[number],
  );
  const bIndex = PREFERRED_DEPARTMENT_ORDER.indexOf(
    b.slug as (typeof PREFERRED_DEPARTMENT_ORDER)[number],
  );

  const aPreferred = aIndex !== -1;
  const bPreferred = bIndex !== -1;

  if (aPreferred && bPreferred) return aIndex - bIndex;
  if (aPreferred) return -1;
  if (bPreferred) return 1;

  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

function compareCategories(
  a: Pick<NormalizedNavCategory, "sort_order" | "name">,
  b: Pick<NormalizedNavCategory, "sort_order" | "name">,
): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

function extractArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value) && Array.isArray(value[key])) return value[key] as unknown[];
  return [];
}

export function sanitizeNavigationCategories(input: unknown): NormalizedNavCategory[] {
  const rawItems = Array.isArray(input) ? input : [];
  const seenSlugs = new Set<string>();

  return rawItems
    .map((item) => {
      if (!isRecord(item)) return null;

      const name = normalizeText(item.name);
      const slug = normalizeSlug(item.slug || item.name);

      if (!name || !slug) return null;

      const category: NormalizedNavCategory = {
        id: normalizeId(item.id),
        name,
        slug,
        sort_order: normalizeSortOrder(item.sort_order),
      };

      const departmentSlug = normalizeSlug(item.department_slug || item.department);
      const departmentName = normalizeText(item.department_name || item.department_label || item.department);
      const departmentSortOrder = normalizeSortOrder(item.department_sort_order);

      if (departmentSlug) category.department_slug = departmentSlug;
      if (departmentName) category.department_name = departmentName;
      if (departmentSortOrder !== 0) category.department_sort_order = departmentSortOrder;

      return category;
    })
    .filter((item): item is NormalizedNavCategory => Boolean(item))
    .sort(compareCategories)
    .filter((item) => {
      if (seenSlugs.has(item.slug)) return false;
      seenSlugs.add(item.slug);
      return true;
    });
}

export function sanitizeNavigationDepartments(input: unknown): NormalizedNavDepartment[] {
  const rawItems = Array.isArray(input) ? input : [];
  const seenDepartmentSlugs = new Set<string>();

  return rawItems
    .map((item) => {
      if (!isRecord(item)) return null;

      const name = normalizeText(item.name);
      const slug = normalizeSlug(item.slug || item.name);

      if (!name || !slug) return null;

      const categories = sanitizeNavigationCategories(item.categories);

      const department: NormalizedNavDepartment = {
        id: normalizeId(item.id),
        name,
        slug,
        sort_order: normalizeSortOrder(item.sort_order),
        categories,
      };

      return department;
    })
    .filter((item): item is NormalizedNavDepartment => Boolean(item))
    .filter((item) => {
      if (seenDepartmentSlugs.has(item.slug)) return false;
      seenDepartmentSlugs.add(item.slug);
      return true;
    })
    .sort(compareByPreferredDepartmentOrder);
}

export function deriveDepartmentsFromLegacyCategories(
  input: unknown,
): NormalizedNavDepartment[] {
  const categories = sanitizeNavigationCategories(input);
  const departmentMap = new Map<string, NormalizedNavDepartment>();

  for (const category of categories) {
    const departmentSlug = normalizeSlug(category.department_slug);
    if (!departmentSlug) continue;

    const current = departmentMap.get(departmentSlug);

    if (!current) {
      departmentMap.set(departmentSlug, {
        id: 0,
        name: normalizeText(category.department_name) || departmentSlug,
        slug: departmentSlug,
        sort_order: normalizeSortOrder(category.department_sort_order),
        categories: [category],
      });
      continue;
    }

    current.categories.push(category);
  }

  return Array.from(departmentMap.values())
    .map((department) => ({
      ...department,
      categories: sanitizeNavigationCategories(department.categories),
    }))
    .filter((department) => department.categories.length > 0)
    .sort(compareByPreferredDepartmentOrder);
}

export function resolveNavigation({
  navigation,
  categories,
}: ResolveNavigationInput): ResolvedNavigation {
  const rawDepartments = extractArray(navigation, "departments");
  const navDepartments = sanitizeNavigationDepartments(rawDepartments);
  const legacyCategories = sanitizeNavigationCategories(categories);

  if (navDepartments.length > 0) {
    return {
      navDepartments,
      legacyCategories,
      usedFallback: false,
      hasStructuredNavigation: true,
    };
  }

  return {
    navDepartments: deriveDepartmentsFromLegacyCategories(legacyCategories),
    legacyCategories,
    usedFallback: legacyCategories.length > 0,
    hasStructuredNavigation: false,
  };
}