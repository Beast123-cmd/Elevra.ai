import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/shell/AppShell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
