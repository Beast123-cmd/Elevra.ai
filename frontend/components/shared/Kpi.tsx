import type { ReactNode } from "react";
import { Empty, Stat } from "./ui-kit";

/** Kept for existing pages; renders the shared Stat so every headline figure looks the same. */
export function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <Stat label={label} value={value} note={hint} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Empty>{children}</Empty>;
}
