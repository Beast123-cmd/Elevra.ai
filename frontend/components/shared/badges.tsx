import { BAND_COLOR, TIER_STYLE } from "@/lib/format";
import type { Tier } from "@/lib/types";

export function RiskBadge({ level, prefix }: { level: Tier; prefix?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TIER_STYLE[level]}`}>
      {prefix ? `${prefix}: ` : ""}
      {level === "Not assessed" ? "Not yet assessed" : level}
    </span>
  );
}

export function BandBadge({ band }: { band: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: BAND_COLOR[band] ?? "#64748b" }}>
      {band}
    </span>
  );
}
