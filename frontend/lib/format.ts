import type { Tier } from "./types";

export const TIER_STYLE: Record<Tier, string> = {
  Red: "bg-red-100 text-red-800 ring-red-200",
  Amber: "bg-amber-100 text-amber-800 ring-amber-200",
  Green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Not assessed": "bg-slate-100 text-slate-600 ring-slate-200",
};
export const BAND_COLOR: Record<string, string> = {
  Thriving: "#059669", "On Track": "#2563eb", "Needs Attention": "#d97706", Critical: "#dc2626",
};
export const SEGMENT_COLOR: Record<string, string> = {
  "Silent disengagers": "#d97706", "Academic stars, placement unready": "#7c3aed",
  "Engaged but struggling": "#ea580c", "Skilled but irregular": "#0891b2",
  "Placement-ready all-rounders": "#059669", "Steady middle": "#64748b",
};
export const fmt = (v: number | null | undefined, d = 0, suffix = "") =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(d)}${suffix}`;
