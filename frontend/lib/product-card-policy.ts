export type ProductCardSurface = "catalog" | "category";

export type ProductCardLoadPolicy = {
  priority: boolean;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "auto";
  eagerBand: boolean;
  revealDeferred: boolean;
};

type ProductCardSurfaceThresholds = {
  priorityUntil: number;
  eagerUntil: number;
};

const DEFAULT_LOW_PRIORITY_POLICY: ProductCardLoadPolicy = {
  priority: false,
  loading: "lazy",
  fetchPriority: "auto",
  eagerBand: false,
  revealDeferred: true,
};

function normalizeCardIndex(index: number): number | null {
  if (!Number.isFinite(index) || Number.isNaN(index) || index < 0) {
    return null;
  }

  return Math.floor(index);
}

function getSurfaceThresholds(
  surface: ProductCardSurface
): ProductCardSurfaceThresholds {
  switch (surface) {
    case "catalog":
    case "category":
    default:
      return {
        priorityUntil: 2,
        eagerUntil: 6,
      };
  }
}

function buildLowPriorityPolicy(): ProductCardLoadPolicy {
  return { ...DEFAULT_LOW_PRIORITY_POLICY };
}

function buildPolicyFromThresholds(
  normalizedIndex: number,
  thresholds: ProductCardSurfaceThresholds
): ProductCardLoadPolicy {
  const priority = normalizedIndex < thresholds.priorityUntil;
  const eagerBand = normalizedIndex < thresholds.eagerUntil;

  return {
    priority,
    loading: eagerBand ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    eagerBand,
    revealDeferred: !eagerBand,
  };
}

export function getProductCardLoadPolicy(
  index: number,
  surface: ProductCardSurface = "catalog"
): ProductCardLoadPolicy {
  const normalizedIndex = normalizeCardIndex(index);

  if (normalizedIndex === null) {
    return buildLowPriorityPolicy();
  }

  const thresholds = getSurfaceThresholds(surface);

  return buildPolicyFromThresholds(normalizedIndex, thresholds);
}