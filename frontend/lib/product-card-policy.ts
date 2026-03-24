export type ProductCardSurface = "catalog" | "category";

export type ProductCardLoadPolicy = {
  priority: boolean;
  loading: "eager" | "lazy";
  fetchPriority: "high" | "auto";
  eagerBand: boolean;
  revealDeferred: boolean;
  groupSizeMobile: number;
  groupSizeDesktop: number;
  revealThreshold: number;
  revealRootMargin: string;
  staggerStepMsMobile: number;
  staggerStepMsDesktop: number;
};

type ProductCardSurfaceThresholds = {
  priorityUntil: number;
  eagerUntil: number;
};

type ProductCardRevealPolicy = {
  groupSizeMobile: number;
  groupSizeDesktop: number;
  revealThreshold: number;
  revealRootMargin: string;
  staggerStepMsMobile: number;
  staggerStepMsDesktop: number;
};

const DEFAULT_GROUP_SIZE_MOBILE = 2;
const DEFAULT_GROUP_SIZE_DESKTOP = 4;
const DEFAULT_REVEAL_THRESHOLD = 0.16;
const DEFAULT_REVEAL_ROOT_MARGIN = "0px 0px -10% 0px";
const DEFAULT_STAGGER_STEP_MS_MOBILE = 70;
const DEFAULT_STAGGER_STEP_MS_DESKTOP = 55;

const DEFAULT_REVEAL_POLICY: ProductCardRevealPolicy = {
  groupSizeMobile: DEFAULT_GROUP_SIZE_MOBILE,
  groupSizeDesktop: DEFAULT_GROUP_SIZE_DESKTOP,
  revealThreshold: DEFAULT_REVEAL_THRESHOLD,
  revealRootMargin: DEFAULT_REVEAL_ROOT_MARGIN,
  staggerStepMsMobile: DEFAULT_STAGGER_STEP_MS_MOBILE,
  staggerStepMsDesktop: DEFAULT_STAGGER_STEP_MS_DESKTOP,
};

const DEFAULT_LOW_PRIORITY_POLICY: ProductCardLoadPolicy = {
  priority: false,
  loading: "lazy",
  fetchPriority: "auto",
  eagerBand: false,
  revealDeferred: true,
  ...DEFAULT_REVEAL_POLICY,
};

function normalizeCardIndex(index: number): number | null {
  if (!Number.isFinite(index) || Number.isNaN(index) || index < 0) {
    return null;
  }

  return Math.floor(index);
}

function getSharedRevealPolicy(): ProductCardRevealPolicy {
  return { ...DEFAULT_REVEAL_POLICY };
}

export function getProductCardRevealGroupSize(isDesktop: boolean): number {
  const revealPolicy = getSharedRevealPolicy();

  return isDesktop ? revealPolicy.groupSizeDesktop : revealPolicy.groupSizeMobile;
}

export function getProductCardRevealDelaySlot(
  index: number,
  groupSize: number
): number {
  const normalizedIndex = normalizeCardIndex(index);
  if (normalizedIndex === null) return 0;

  const normalizedGroupSize = Number.isFinite(groupSize) && groupSize > 0
    ? Math.floor(groupSize)
    : 1;

  return normalizedIndex % normalizedGroupSize;
}

export function getProductCardRevealDelayMs(
  index: number,
  groupSize: number,
  isDesktop: boolean
): number {
  const revealPolicy = getSharedRevealPolicy();
  const delaySlot = getProductCardRevealDelaySlot(index, groupSize);
  const staggerStepMs = isDesktop
    ? revealPolicy.staggerStepMsDesktop
    : revealPolicy.staggerStepMsMobile;

  return delaySlot * staggerStepMs;
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

  const revealPolicy = getSharedRevealPolicy();

  return {
    priority,
    loading: eagerBand ? "eager" : "lazy",
    fetchPriority: priority ? "high" : "auto",
    eagerBand,
    revealDeferred: !eagerBand,
    ...revealPolicy,
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