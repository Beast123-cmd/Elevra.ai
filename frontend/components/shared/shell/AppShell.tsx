"use client";
import {
  Activity, Award, BarChart3, Bell, BookOpen, CalendarDays, ClipboardCheck, Compass, Database, FileCheck2, House, Inbox, ListChecks, Flame,
  LogOut, Menu, MessageSquareText, Mic2, PanelLeftClose, PanelLeftOpen, PieChart, ShieldCheck, ShoppingBag, Trophy, Users, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/shared/Brand";
import { getIdentity, signOutAndLeave } from "@/components/shared/session";
import { createClient } from "@/lib/supabase/client";
import { currentLabel, isActive, NAV, roleFromPath, type IconName, type ShellRole } from "./nav";
import { useApiStatus } from "./useApiStatus";
import { ThemeToggle } from "./ThemeToggle";
import { GuidedWalkthrough } from "./GuidedWalkthrough";

const ICONS: Record<IconName, LucideIcon> = {
  overview: BarChart3, workload: Activity, interventions: ClipboardCheck, notifications: Bell, queue: ListChecks,
  attendance: CalendarDays, segments: PieChart, dataHealth: Database, method: ShieldCheck, evidence: FileCheck2,
  chat: MessageSquareText, users: Users, demo: Compass, home: House, plan: BookOpen, certifications: Award, achievements: Award, daily: Flame,
  hackathons: Trophy, events: CalendarDays, interview: Mic2, inbox: Inbox,
};
const ROLE_LABEL: Record<ShellRole, string> = { admin: "Administrator", faculty: "Faculty mentor", student: "Student" };
const COLLAPSE_KEY = "elevra-sidebar-collapsed";

function NavList({ role, path, collapsed, onNavigate }: { role: ShellRole; path: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {NAV[role].map((group, gi) => (
        <div key={group.label ?? gi} className="flex flex-col gap-0.5">
          {group.label && (
            <p className={`mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground ${collapsed ? "lg:sr-only" : ""}`}>{group.label}</p>
          )}
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const on = isActive(path, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={on ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm no-underline transition-[background-color,color,transform,box-shadow] duration-[180ms] ease-out active:scale-[.985] active:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transform-none motion-reduce:transition-none before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:transition-transform before:duration-200 before:ease-out motion-reduce:before:transition-none ${
                  on
                    ? "bg-primary/10 font-semibold text-foreground before:scale-y-100"
                    : "text-muted-foreground before:scale-y-0 hover:translate-x-0.5 hover:bg-card/80 hover:text-foreground focus-visible:bg-card/80"
                } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-150 ease-out group-hover:scale-105 group-active:scale-95 motion-reduce:transform-none motion-reduce:transition-none ${on ? "text-primary" : ""}`} aria-hidden="true" />
                <span className={`truncate ${collapsed ? "lg:sr-only" : ""}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Wordmark({ hideText = false }: { hideText?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark compact />
      <span className={`text-[17px] font-semibold tracking-[-0.04em] text-foreground ${hideText ? "lg:sr-only" : ""}`}>
        elevra<span className="font-normal text-muted-foreground">.ai</span>
      </span>
    </span>
  );
}

/**
 * The one frame every signed-in page sits in. Desktop (1024px and up): a sidebar that can collapse to icons.
 * Below that: a top bar with a menu button that opens the same navigation as a drawer.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const [role, setRole] = useState<ShellRole>(roleFromPath(path));
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState("");
  const [identityReady, setIdentityReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const apiStatus = useApiStatus();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getIdentity().then((id) => { if (id?.role) setRole(id.role as ShellRole); if (id?.userId) setUserId(id.userId); }).finally(() => setIdentityReady(true));
    createClient().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ""));
    try { setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* default: expanded */ }
  }, []);

  // the drawer closes on navigation, on Escape, and returns focus to the menu button
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    const panel = drawerRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>("a,button"));
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const button = menuButton.current;
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; button?.focus(); };
  }, [drawer]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try { window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* not remembered */ }
      return !c;
    });
  }

  const label = currentLabel(path, role);
  const initial = (email[0] ?? ROLE_LABEL[role][0]).toUpperCase();

  return (
    <div className={`min-h-screen bg-background lg:grid lg:transition-[grid-template-columns] lg:duration-[240ms] lg:ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none ${collapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[244px_minmax(0,1fr)]"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2">Skip to content</a>

      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 lg:flex">
        <div className={`mb-6 flex min-h-10 items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          {collapsed ? (
            <button type="button" onClick={toggleCollapsed} className="group grid h-10 w-10 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-card hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" aria-label="Expand sidebar">
              <PanelLeftOpen className="h-4 w-4 transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none" aria-hidden="true" />
            </button>
          ) : (
            <>
              <Link href={NAV[role][0].items[0].href} className="no-underline" aria-label="Elevra home"><Wordmark /></Link>
              <button type="button" onClick={toggleCollapsed} className="group grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-card hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none" aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4 transition-transform duration-150 ease-out group-hover:scale-105 motion-reduce:transition-none" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavList role={role} path={path} collapsed={collapsed} /></div>
        <div className={`mt-auto border-t border-sidebar-border pt-3 ${collapsed ? "flex justify-center px-0" : "px-1"}`}>
          <div className={`flex min-h-11 items-center gap-3 ${collapsed ? "justify-center" : ""}`} title={collapsed ? `${email || ROLE_LABEL[role]} · ${ROLE_LABEL[role]}` : undefined}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted font-serif text-sm font-semibold text-primary">{initial}</span>
            {!collapsed && <span className="min-w-0 leading-tight">
              <span className="block truncate text-xs font-medium">{email || ROLE_LABEL[role]}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABEL[role]}</span>
            </span>}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
            <button ref={menuButton} type="button" onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-md text-foreground hover:bg-muted lg:hidden" aria-label="Open navigation" aria-expanded={drawer} aria-controls="app-drawer">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="truncate text-sm font-medium lg:hidden">{label ?? "Elevra"}</span>
            <span className="hidden text-xs font-medium tracking-wide text-muted-foreground sm:block">Campus success, made visible</span>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {identityReady && userId && <GuidedWalkthrough role={role} ready={identityReady} userId={userId} />}
              {role === "student" && <Link href="/student/store" aria-label="Rewards store" title="Rewards store" className="grid h-10 w-10 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" /></Link>}
              <ThemeToggle />
              <button type="button" onClick={signOutAndLeave} className="flex h-10 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out">
                <LogOut className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>

        {apiStatus === "down" && (
          <div role="status" className="border-b border-risk-amber/30 bg-risk-amber-bg px-4 py-2 text-[13px] text-risk-amber">
            <div className="mx-auto max-w-[1320px] sm:px-2 lg:px-4">
              <strong className="font-semibold">The Elevra server is not reachable.</strong>{" "}
              Dashboards and student records still work. Creating accounts, AI summaries, the assistant, the simulator and the mock interview need the server and will work again as soon as it is back.
            </div>
          </div>
        )}

        <main id="main" className={`mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${role !== "student" ? "!pb-24" : ""}`}>{children}</main>
      </div>

      {role !== "student" && (
        <Link href="/insights/assistant" aria-label="Ask Elevra" title="Ask Elevra"
          className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-slate-900/20 transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 sm:px-4 motion-reduce:transform-none">
          <MessageSquareText className="h-5 w-5" aria-hidden="true" /><span>Ask</span>
        </Link>
      )}

      {/* mobile and tablet drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-foreground/30" aria-label="Close navigation" tabIndex={-1} onClick={() => setDrawer(false)} />
          <div id="app-drawer" ref={drawerRef} className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-1">
              <Wordmark />
              <button type="button" onClick={() => setDrawer(false)} className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-card" aria-label="Close navigation">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavList role={role} path={path} collapsed={false} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto border-t border-sidebar-border px-1 pt-3">
              <div className="flex min-h-11 items-center gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted font-serif text-sm font-semibold text-primary">{initial}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-xs font-medium">{email || ROLE_LABEL[role]}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABEL[role]}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
