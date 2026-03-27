export type SizeGuideRow = {
  size: string;
  values: Array<string | number>;
};

export type SizeGuide = {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: SizeGuideRow[];
};