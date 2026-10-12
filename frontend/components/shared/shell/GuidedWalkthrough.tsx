"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Compass, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ShellRole } from "./nav";

interface TourStep {
  href: string;
  target: string;
  title: string;
  description: string;
}

const STEPS: Record<ShellRole, TourStep[]> = {
  student: [
    { href: "/student", target: "student-score", title: "Your Success Score", description: "This score combines the records available across your academic, attendance, learning, career and skills areas. The bars show what is contributing to it." },
    { href: "/student/improve", target: "student-what-if", title: "Try a what-if", description: "Adjust a value to see how it could change your score. These estimates are private and do not edit your saved records." },
    { href: "/student/certifications", target: "student-course-search", title: "Find a course", description: "Search and filter courses matched to your department and development areas. Open a result to view it with the provider." },
    { href: "/student/hackathons", target: "student-event-search", title: "Explore events", description: "Search current hackathons and contests, then narrow the list by type or format in Filter." },
    { href: "/student/interview", target: "student-interview-start", title: "Practise an interview", description: "Add resume text or a PDF, then start a practice interview. You can answer by typing, with voice available as an option." },
    { href: "/student/notifications", target: "student-inbox", title: "Your campus inbox", description: "See placement drives and announcements sent to your department, year or account. Open a notice for its details." },
  ],
  faculty: [
    { href: "/faculty", target: "shared-queue-search", title: "Find the students who need a check-in", description: "Search mentees by name or ID. Use Filter to narrow by year, risk, segment or recent contact, then open a student for their full record." },
    { href: "/faculty/attendance", target: "faculty-attendance-filter", title: "Plan attendance recovery", description: "Search for a student and use Filter to set the attendance status or adjust the campus attendance assumptions. The list below shows how many classes remain." },
    { href: "/insights/segments", target: "shared-segment-filter", title: "Focus on a student group", description: "Choose a segment, department or year in Filter. The student list and group profile update together so you can focus follow-up." },
    { href: "/insights/data-health", target: "shared-data-cleaning", title: "Check the source data", description: "The cleaning log shows how source records were corrected or excluded before they reached the student view." },
    { href: "/insights/method", target: "shared-method-score", title: "Understand the score", description: "Review how the Success Score is built, how the risk model was checked and where the data has limitations." },
  ],
  admin: [
    { href: "/admin", target: "admin-overview-filter", title: "Set the overview scope", description: "Search students by name or ID. Use Filter to compare the institution by department, year or batch; every overview chart and KPI follows this selection." },
    { href: "/admin/workload", target: "admin-workload-tasks", title: "Create planned check-ins", description: "This creates a follow-up task for each Red student who has not been contacted this week. Mentors see the tasks in their follow-up list." },
    { href: "/admin/interventions", target: "admin-intervention-results", title: "Review intervention outcomes", description: "Compare average score changes by intervention type and inspect the records behind the summary." },
    { href: "/admin/notifications", target: "admin-notification-send", title: "Send a campus update", description: "Choose who should receive the notice, enter its title and message, then post it to the selected students’ inboxes." },
    { href: "/faculty", target: "shared-queue-search", title: "Review the action queue", description: "Search the student list and use Filter to narrow by risk, segment, year or mentor. Open a row to review the student record." },
    { href: "/faculty/attendance", target: "faculty-attendance-filter", title: "Plan attendance recovery", description: "Filter by attendance status, adjust the policy assumptions, then use the student list to see who can still reach the required attendance." },
    { href: "/insights/segments", target: "shared-segment-filter", title: "Review student segments", description: "Choose a group in Filter to see its rule, recommended action and matching students." },
    { href: "/insights/data-health", target: "shared-data-cleaning", title: "Audit data cleaning", description: "Inspect source coverage and the cleaning log to see how records were resolved, corrected or excluded." },
    { href: "/insights/method", target: "admin-method-weights", title: "Try score weights", description: "Adjust the area weights to preview how the cohort would shift, then use the re-score action to apply the same scoring engine." },
    { href: "/admin/evidence", target: "admin-evidence-download", title: "Prepare evidence", description: "Download the learner and mentor lists used in the evidence summary, or print the page for review." },
    { href: "/admin/users", target: "admin-create-user", title: "Manage accounts", description: "Create a student, faculty or admin account. The form links the account to a student or faculty record when needed." },
  ],
};

const STORAGE_KEY = "elevra-guided-walkthrough";
const SEEN_KEY = "elevra-guided-walkthrough-seen";
interface SavedTour { userId: string; role: ShellRole; index: number }
interface Position { top: number; left: number; width: number; height: number; radius: number }

function readSavedTour(userId: string): SavedTour | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as SavedTour;
    return parsed && parsed.userId === userId && (parsed.role === "student" || parsed.role === "faculty" || parsed.role === "admin") && Number.isInteger(parsed.index)
      ? parsed
      : null;
  } catch { return null; }
}

/** A route-aware tour anchored to real dashboard controls. */
export function GuidedWalkthrough({ role, ready, userId }: { role: ShellRole; ready: boolean; userId: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [index, setIndex] = useState<number | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const initializedForUser = useRef("");
  const steps = STEPS[role];
  const active = index !== null;
  const step = active ? steps[index] : null;

  const stop = useCallback((completed: boolean) => {
    setIndex(null);
    setPosition(null);
    anchorRef.current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      if (completed && userId) localStorage.setItem(`${SEEN_KEY}:${userId}`, "1");
    } catch { /* storage may be unavailable */ }
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, [userId]);

  const save = useCallback((nextRole: ShellRole, nextIndex: number) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, role: nextRole, index: nextIndex } satisfies SavedTour)); } catch { /* route navigation still works */ }
  }, [userId]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0) return;
    if (nextIndex >= steps.length) { stop(true); return; }
    save(role, nextIndex);
    setIndex(nextIndex);
    setPosition(null);
    const next = steps[nextIndex];
    if (pathname !== next.href) router.push(next.href);
  }, [pathname, role, router, save, steps, stop]);

  useEffect(() => {
    if (!ready || !userId || index !== null || initializedForUser.current === userId) return;
    initializedForUser.current = userId;
    const saved = readSavedTour(userId);
    if (saved?.role === role && saved.index >= 0 && saved.index < steps.length) {
      setIndex(saved.index);
      return;
    }
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      if (!localStorage.getItem(`${SEEN_KEY}:${userId}`)) {
        save(role, 0);
        setIndex(0);
      }
    } catch { /* storage may be unavailable; leave the manual launcher available */ }
  }, [index, ready, role, save, steps.length, userId]);

  useEffect(() => {
    if (!active || !step) return;
    if (pathname !== step.href) {
      router.push(step.href);
      return;
    }

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let resize: ResizeObserver | null = null;
    let timeout = 0;
    const update = () => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!element || !element.isConnected) return false;
      if (anchorRef.current !== element) {
        anchorRef.current = element;
        element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center", inline: "nearest" });
        resize?.disconnect();
        resize = new ResizeObserver(() => update());
        resize.observe(element);
      }
      const rect = element.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, radius: Math.min(16, parseFloat(getComputedStyle(element).borderRadius) || 8) });
      return true;
    };

    let frame = 0;
    const onScroll = () => {
      if (!anchorRef.current || frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; update(); });
    };
    const find = () => {
      if (cancelled) return;
      if (update()) {
        observer?.disconnect();
        window.clearTimeout(timeout);
      }
    };
    find();
    if (!anchorRef.current) {
      observer = new MutationObserver(find);
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = window.setTimeout(() => { observer?.disconnect(); if (!cancelled && !anchorRef.current) stop(false); }, 12000);
    }
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelled = true;
      observer?.disconnect();
      resize?.disconnect();
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      anchorRef.current = null;
    };
  }, [active, pathname, router, step, stop]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop(true);
      else if (event.key === "ArrowRight") goTo((index ?? 0) + 1);
      else if (event.key === "ArrowLeft") goTo((index ?? 0) - 1);
      else if (event.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, goTo, index, stop]);

  const hasPosition = position !== null;
  useEffect(() => {
    if (!active || !hasPosition) return;
    const frame = window.requestAnimationFrame(() => nextButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [active, hasPosition, index]);

  const start = () => goTo(0);
  const next = () => goTo((index ?? 0) + 1);
  const back = () => goTo((index ?? 0) - 1);
  let tooltip: { top: number; left: number; width: number } | null = null;
  if (position) {
    const width = Math.min(360, window.innerWidth - 32);
    const left = Math.max(16, Math.min(window.innerWidth - width - 16, position.left + position.width / 2 - width / 2));
    const estimatedHeight = 218;
    const top = position.top + position.height + 14 + estimatedHeight < window.innerHeight
      ? position.top + position.height + 14
      : Math.max(16, position.top - estimatedHeight - 14);
    tooltip = { top, left, width };
  }

  return (
    <>
      <button ref={launcherRef} type="button" onClick={start} title="Walk me through this dashboard" aria-label="Start dashboard walkthrough"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3">
        <Compass className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Walkthrough</span>
      </button>
      {active && step && position && tooltip && (
        createPortal(<>
          <div aria-hidden="true" className="fixed z-[70] pointer-events-none border-2 border-primary shadow-[0_0_0_9999px_rgba(5,12,9,0.72),0_0_30px_rgba(45,157,131,0.20)] transition-[top,left,width,height] duration-300 ease-out"
            style={{ top: position.top - 4, left: position.left - 4, width: position.width + 8, height: position.height + 8, borderRadius: position.radius + 4 }} />
          <section ref={dialogRef} role="dialog" aria-label={`Walkthrough, step ${(index ?? 0) + 1} of ${steps.length}`} aria-modal="true"
            className="fixed z-[71] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-2xl shadow-black/30"
            style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Step {(index ?? 0) + 1} of {steps.length}</p>
                <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
              </div>
              <button type="button" onClick={() => stop(true)} aria-label="Skip walkthrough" title="Skip walkthrough" className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{step.description}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => stop(true)} className="h-9 rounded-lg px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Skip walkthrough</button>
              <button type="button" onClick={back} disabled={index === 0} className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40">Back</button>
              <button ref={nextButtonRef} type="button" onClick={next} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {index === steps.length - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </section>
        </>, document.body)
      )}
    </>
  );
}
