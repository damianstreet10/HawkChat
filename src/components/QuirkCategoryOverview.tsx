"use client";

import {
  QUIRK_CATEGORIES,
  QUIRK_CATEGORY_LABELS,
  type QuirkCategory,
} from "@/lib/quirk-category";

export type QuirkStatsPayload = {
  total: number;
  byCategory: Record<string, number>;
  percentages: Record<string, number>;
};

const SEGMENT_COLORS: Record<QuirkCategory | "uncategorized", string> = {
  network: "#38bdf8",
  hardware: "#a78bfa",
  pc: "#818cf8",
  camera: "#2dd4bf",
  other: "#94a3b8",
  uncategorized: "#64748b",
};

const SEGMENT_ORDER: Array<QuirkCategory | "uncategorized"> = [
  ...QUIRK_CATEGORIES,
  "uncategorized",
];

function segmentLabel(key: QuirkCategory | "uncategorized"): string {
  if (key === "uncategorized") return "Uncategorized";
  return QUIRK_CATEGORY_LABELS[key];
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlice(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): string {
  if (end - start >= 359.99) {
    end = start + 359.99;
  }
  const large = end - start > 180 ? 1 : 0;
  const oStart = polar(cx, cy, outer, start);
  const oEnd = polar(cx, cy, outer, end);
  const iEnd = polar(cx, cy, inner, end);
  const iStart = polar(cx, cy, inner, start);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

function buildSegments(stats: QuirkStatsPayload) {
  return SEGMENT_ORDER.map((key) => ({
    key,
    label: segmentLabel(key),
    count: stats.byCategory[key] ?? 0,
    percent: stats.percentages[key] ?? 0,
    color: SEGMENT_COLORS[key],
  })).filter((s) => s.count > 0);
}

export function QuirkCategoryOverview({
  stats,
  loading,
}: {
  stats: QuirkStatsPayload | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-hawk-400">Loading overview…</p>;
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="hawk-card-muted p-12 text-center">
        <p className="text-hawk-300">
          No quirk reports yet. Tag reports by type to see breakdowns here.
        </p>
      </div>
    );
  }

  const segments = buildSegments(stats);
  const taggedTotal = stats.total - (stats.byCategory.uncategorized ?? 0);

  if (segments.length === 0) {
    return (
      <div className="hawk-card-muted p-12 text-center">
        <p className="text-hawk-300">No quirk reports yet.</p>
      </div>
    );
  }

  const majority = [...segments].sort((a, b) => b.count - a.count)[0];
  let cursor = 0;
  const slices = segments.map((seg) => {
    const sweep = (seg.count / stats.total) * 360;
    const slice = {
      ...seg,
      start: cursor,
      end: cursor + sweep,
    };
    cursor += sweep;
    return slice;
  });

  const cx = 120;
  const cy = 120;
  const outer = 100;
  const inner = 58;

  return (
    <div className="hawk-card p-8">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <div className="relative shrink-0">
          <svg
            viewBox="0 0 240 240"
            className="h-56 w-56"
            role="img"
            aria-label="Quirk reports by problem type"
          >
            {slices.map((slice) => (
              <path
                key={slice.key}
                d={donutSlice(cx, cy, outer, inner, slice.start, slice.end)}
                fill={slice.color}
                stroke="#0f172a"
                strokeWidth={1.5}
              />
            ))}
            <circle cx={cx} cy={cy} r={inner - 1} fill="#0f172a" />
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="fill-hawk-100 text-[11px] font-semibold"
              style={{ fontSize: 11, fill: "#f1f5f9" }}
            >
              {stats.total}
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              style={{ fontSize: 9, fill: "#94a3b8" }}
            >
              reports
            </text>
          </svg>
        </div>

        <div className="w-full max-w-md">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange">
            Overview
          </p>
          <h3 className="font-display mb-2 text-xl font-bold text-hawk-50">
            Issues by type
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-hawk-300">
            <span className="font-semibold text-hawk-100">{majority.label}</span>{" "}
            is the largest share at{" "}
            <span className="font-semibold text-orange-light">
              {majority.percent}%
            </span>{" "}
            ({majority.count} of {stats.total} report
            {stats.total === 1 ? "" : "s"}).
            {taggedTotal < stats.total && (
              <>
                {" "}
                {stats.total - taggedTotal} still untagged — assign types on the
                Reports tab for a fuller picture.
              </>
            )}
          </p>

          <ul className="space-y-3">
            {segments.map((seg) => (
              <li key={seg.key} className="flex items-center gap-3 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                  aria-hidden
                />
                <span className="flex-1 text-hawk-200">{seg.label}</span>
                <span className="font-mono text-hawk-400">{seg.count}</span>
                <span className="w-12 text-right font-semibold text-hawk-100">
                  {seg.percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
