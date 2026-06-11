export const QUIRK_CATEGORIES = [
  "network",
  "hardware",
  "pc",
  "camera",
  "other",
] as const;

export type QuirkCategory = (typeof QUIRK_CATEGORIES)[number];
export type QuirkCategoryFilter = QuirkCategory | "all" | "uncategorized";

export const QUIRK_CATEGORY_LABELS: Record<QuirkCategory, string> = {
  network: "Network",
  hardware: "Hardware",
  pc: "PC",
  camera: "Camera",
  other: "Other",
};

export const QUIRK_CATEGORY_FILTERS: Array<{
  id: QuirkCategoryFilter;
  label: string;
}> = [
  { id: "all", label: "All types" },
  { id: "uncategorized", label: "Uncategorized" },
  ...QUIRK_CATEGORIES.map((id) => ({
    id,
    label: QUIRK_CATEGORY_LABELS[id],
  })),
];

export function isQuirkCategory(value: string): value is QuirkCategory {
  return (QUIRK_CATEGORIES as readonly string[]).includes(value);
}

export function isQuirkCategoryFilter(
  value: string,
): value is QuirkCategoryFilter {
  return (
    value === "all" ||
    value === "uncategorized" ||
    isQuirkCategory(value)
  );
}
