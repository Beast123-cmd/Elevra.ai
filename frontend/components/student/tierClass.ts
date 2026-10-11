import type { Tier } from "@/lib/types";

/** Risk tag colours from the theme tokens, so they follow light and dark mode. */
export const TIER_CLASS: Record<Tier, string> = { Red: "bg-risk-red-bg text-risk-red", Amber: "bg-risk-amber-bg text-risk-amber", Green: "bg-risk-green-bg text-risk-green", "Not assessed": "bg-risk-none-bg text-risk-none" };
