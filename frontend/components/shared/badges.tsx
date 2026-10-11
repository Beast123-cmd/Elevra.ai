import type { Tier } from "@/lib/types";
import { BandTag, RiskTag } from "./ui-kit";

/** Kept for existing pages; both render the shared token-based tags. */
export function RiskBadge({ level, prefix }: { level: Tier; prefix?: string }) {
  return <RiskTag level={level} prefix={prefix} />;
}

export function BandBadge({ band }: { band: string }) {
  return <BandTag band={band} />;
}
