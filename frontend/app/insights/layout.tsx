import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/shell/AppShell";

// Insights pages are for admin and faculty, so they sit in the same shell and navigation as those areas.
export default function InsightsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
