"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Database, FileCheck2, Gauge, Github, Layers3, Linkedin, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Brand } from "@/components/shared/Brand";

const SIGNALS = [
  { label: "Academics", detail: "CGPA, internal marks and backlogs" },
  { label: "Attendance", detail: "Weekly and subject attendance" },
  { label: "Learning activity", detail: "Submissions, logins and study time" },
  { label: "Engagement", detail: "Clubs, events and co-curricular activity" },
  { label: "Skills", detail: "Technical skills, soft skills and certifications" },
  { label: "Feedback", detail: "Student satisfaction and faculty feedback" },
  { label: "Placement", detail: "Aptitude, coding and interview readiness" },
];

const STORY = [
  {
    id: 1,
    eyebrow: "01 / CONNECT",
    title: "Seven sources. One student record.",
    body: "Academic, attendance, learning and career records arrive in different formats. Elevra resolves student IDs, brings the records together and makes data quality visible.",
    note: "Start with a view that is complete enough to trust.",
  },
  {
    id: 2,
    eyebrow: "02 / UNDERSTAND",
    title: "A score with its reasons attached.",
    body: "The success score uses the information available for each student. Separate academic and placement signals show the drivers behind a flag, with missing data kept in view.",
    note: "A guidance signal with context, never a verdict.",
  },
  {
    id: 3,
    eyebrow: "03 / SUPPORT",
    title: "Turn an early signal into a useful next step.",
    body: "Students can focus on a practical improvement path. Mentors can see who may need a check-in, understand why, and keep support connected to what happens next.",
    note: "Move from late surprises to timely conversations.",
  },
];

const MVP = [
  { icon: Database, title: "Seven-source data integration", detail: "Student records unified with ID resolution, cleaning notes and source coverage." },
  { icon: Gauge, title: "Explainable success score", detail: "Seven pillars, data confidence and named drivers shown together." },
  { icon: ShieldCheck, title: "Two clear risk signals", detail: "Academic and placement needs assessed separately, with a visible reason for each." },
  { icon: Sparkles, title: "Student improvement path", detail: "What-if exploration, skill gaps and relevant next steps in the student workspace." },
  { icon: UsersRound, title: "Mentor and campus views", detail: "A prioritized check-in queue plus cohort patterns and data-health insights." },
];

const TEAM = [
  { name: "Utkarsh Waghmare", initials: "UW", linkedin: "https://www.linkedin.com/in/utkarsh-waghmare-39a068254/", github: "https://github.com/beutkarshh" },
  { name: "Aayush Angal", initials: "AA", linkedin: "https://www.linkedin.com/in/aayushangal/", github: "https://github.com/Beast123-cmd" },
  { name: "Mahesh Loya", initials: "ML", linkedin: "https://www.linkedin.com/in/maheshloya/", github: "https://github.com/Mahesh-Loya" },
] as const;

function FlowIllustration({ step, signal, onSignalChange }: { step: number; signal: number; onSignalChange: (index: number) => void }) {
  const [showAll, setShowAll] = useState(false);
  const activeSignal = SIGNALS[signal];
  const visibleSignals = SIGNALS.slice(0, 3);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dbe5df] bg-white shadow-[0_28px_90px_-56px_rgba(16,55,47,.42)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf2ed] text-[#286a62]"><Layers3 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-[#172824]">From campus data to student support</p><p className="mt-0.5 text-[10px] text-slate-500">Explore a step or select a signal</p></div>
        </div>
        <div className="flex shrink-0 gap-1.5" aria-label="Journey step">
          {STORY.map((item) => <span key={item.id} className={`h-1.5 rounded-full transition-all duration-300 ${step === item.id ? "w-6 bg-[#286a62]" : "w-1.5 bg-[#dce5df]"}`} aria-hidden="true" />)}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {step === 1 && (
          <div key="connect" className="flow-step-content flex min-h-[295px] flex-col justify-center sm:min-h-[300px]">
            <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] sm:gap-2">
              <div className="min-w-0">
                <p className="mb-2.5 text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500 sm:text-[10px]">Campus signals</p>
                <div className="space-y-1.5">
                  {visibleSignals.map((item) => {
                    const index = SIGNALS.indexOf(item);
                    return <button key={item.label} type="button" onClick={() => onSignalChange(index)} aria-pressed={signal === index} className={`flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg border px-2 text-left text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] sm:px-2.5 sm:text-[11px] ${signal === index ? "border-[#91b7a5] bg-[#f0f6f1] text-[#1c564c]" : "border-slate-100 bg-[#fafbf9] text-slate-600 hover:border-[#c4d7cc] hover:bg-[#f5f8f5]"}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${signal === index ? "bg-[#286a62]" : "bg-[#aebdb3]"}`} aria-hidden="true" /><span className="truncate">{item.label}</span>
                    </button>;
                  })}
                </div>
                <button type="button" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll} aria-controls="more-campus-signals" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[10px] font-semibold text-[#286a62] hover:text-[#154e49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
                  {showAll ? "Show fewer" : "+ 4 more sources"}<ChevronDown className={`h-3 w-3 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              </div>

              <div className="flex justify-center text-[#789087]" aria-hidden="true">
                <svg viewBox="0 0 44 92" className="h-24 w-7 sm:w-10" fill="none">
                  <path className="data-flow-path" d="M2 12H12C19 12 19 46 27 46H39M2 46H39M2 80H12C19 80 19 46 27 46" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 5" />
                  <path d="m34 41 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle className="data-flow-dot" cx="4" cy="46" r="2.5" fill="#4a8174" />
                </svg>
              </div>

              <div className="min-w-0 rounded-xl bg-[#173f38] p-3.5 text-white sm:p-4">
                <div className="flex items-center gap-2 text-[10px] font-medium text-[#c7ddd3]"><Database className="h-3.5 w-3.5" aria-hidden="true" /> Unified student view</div>
                <div key={signal} className="signal-detail mt-3 rounded-lg bg-white/[.08] p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[.12em] text-[#b8d1c6]">Selected signal</p>
                  <p className="mt-2 text-xs font-semibold leading-4">{activeSignal.label}</p>
                  <p className="mt-1.5 text-[10px] leading-4 text-[#d3e0da]">{activeSignal.detail}</p>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[9px] text-[#d3e0da]"><Check className="h-3 w-3 text-[#b6d8c8]" aria-hidden="true" />Matched to a student record</div>
              </div>
            </div>
            {showAll && <div id="more-campus-signals" className="mt-3 flex flex-wrap gap-1.5" aria-label="More campus signals">{SIGNALS.slice(3).map((item) => { const index = SIGNALS.indexOf(item); return <button key={item.label} type="button" onClick={() => onSignalChange(index)} aria-pressed={signal === index} className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] ${signal === index ? "border-[#91b7a5] bg-[#f0f6f1] text-[#1c564c]" : "border-slate-100 bg-[#fafbf9] text-slate-600 hover:border-[#c4d7cc]"}`}><span className="h-1.5 w-1.5 rounded-full bg-[#7e9f8f]" aria-hidden="true" />{item.label}</button>; })}</div>}
            <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">Select a signal to see the kind of information it contributes.</p>
          </div>
        )}

        {step === 2 && (
          <div key="understand" className="flow-step-content flex min-h-[295px] flex-col justify-center sm:min-h-[300px]">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#173f38] p-3.5 text-white sm:p-4">
              <div><p className="text-[10px] font-medium text-[#c7ddd3]">Student success score</p><p className="mt-1 text-2xl font-semibold tracking-[-.04em]">0–100</p><p className="mt-1 text-[10px] text-[#d3e0da]">Only available data is included</p></div>
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[5px] border-[#6c9b88] border-r-[#c4dbc9] text-[9px] font-semibold text-[#e3eee7]">DATA<br />COVERAGE</div>
            </div>
            <div className="mt-2 rounded-xl border border-slate-100 p-3 sm:p-3.5">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold text-slate-700">Seven score pillars</p><p className="text-[9px] text-slate-400">By methodology</p></div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 min-[360px]:grid-cols-4 sm:grid-cols-4">
                {["Academic", "Attendance", "Learning", "Placement", "Skills", "Engagement", "Feedback"].map((label, index) => <div key={label} className={`flex min-h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-[8px] font-medium sm:gap-1.5 sm:px-2 sm:text-[9px] ${signal % 7 === index ? "bg-[#eaf2ed] text-[#1c564c]" : "bg-[#f7f8f6] text-slate-600"}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${signal % 7 === index ? "bg-[#286a62]" : "bg-[#b8c8bd]"}`} aria-hidden="true" /><span className="truncate">{label}</span></div>)}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {["Academic risk", "Placement risk"].map((label) => <div key={label} className="flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 px-2 text-[9px] font-medium text-slate-700 sm:gap-2 sm:px-3 sm:text-[10px]"><CircleHelp className="h-3.5 w-3.5 shrink-0 text-[#558477]" aria-hidden="true" /><span className="truncate">{label}</span></div>)}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2.5 text-[10px] leading-4 text-slate-500">Drivers explain each signal. Missing information stays visible.</p>
          </div>
        )}

        {step === 3 && (
          <div key="support" className="flow-step-content flex min-h-[295px] flex-col justify-center gap-3 sm:min-h-[300px] sm:gap-4">
            {[
              { icon: Gauge, title: "Notice", body: "A student may need a check-in", tag: "Signal + reason" },
              { icon: FileCheck2, title: "Choose", body: "Review a practical support step", tag: "Student plan" },
              { icon: UsersRound, title: "Follow through", body: "Keep the support conversation connected", tag: "Mentor workflow" },
            ].map(({ icon: Icon, title, body, tag }, index) => <div key={title} className="relative flex items-center gap-3 rounded-xl border border-slate-100 bg-[#fafbf9] p-3.5 sm:p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eaf2ed] text-[#286a62]"><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-xs font-semibold text-[#172824]">{title}</p><span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-500">{tag}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">{body}</p></div>
              {index < 2 && <span className="absolute -bottom-[13px] left-[33px] z-10 h-3 border-l border-dashed border-[#99b3a5]" aria-hidden="true" />}
            </div>)}
            <p className="mt-1 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">A clear reason helps make the next conversation more useful.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeStep, setActiveStep] = useState(1);
  const [activeSignal, setActiveSignal] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef(1);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-journey-step]"));
    if (!sections.length) return;
    let updateTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(() => {
      const center = window.innerHeight / 2;
      const current = sections
        .map((section) => ({ section, rect: section.getBoundingClientRect() }))
        .filter(({ rect }) => rect.top < center && rect.bottom > center)
        .sort((a, b) => Math.abs(a.rect.top + a.rect.height / 2 - center) - Math.abs(b.rect.top + b.rect.height / 2 - center))[0];
      if (!current) {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = undefined;
        return;
      }
      const nextStep = Number(current.section.dataset.journeyStep);
      if (nextStep === activeStepRef.current) {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = undefined;
        return;
      }
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        activeStepRef.current = nextStep;
        setActiveStep(nextStep);
        updateTimer = undefined;
      }, 90);
    }, { rootMargin: "-44% 0px -44% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, []);

  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!targets.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).dataset.revealed = "true";
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });

    targets.forEach((target) => {
      const rect = target.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        target.dataset.revealed = "true";
      } else {
        observer.observe(target);
      }
    });
    root.classList.add("reveal-ready");
    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-slate-950">
      <style jsx global>{`
        @keyframes data-flow { to { stroke-dashoffset: -36; } }
        @keyframes data-dot { 0% { transform: translateX(0); opacity: .25; } 55% { opacity: 1; } 100% { transform: translateX(25px); opacity: 0; } }
        @keyframes flow-reveal { from { opacity: .65; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .data-flow-path { animation: data-flow 3.2s linear infinite; }
        .data-flow-dot { animation: data-dot 3.2s ease-in-out infinite; }
        .flow-step-content { animation: flow-reveal .22s ease-out both; }
        .signal-detail { animation: flow-reveal .2s ease-out both; }
        .landing-page.reveal-ready [data-reveal] { opacity: 0; transform: translate3d(0, 16px, 0); transition: opacity .55s cubic-bezier(.2,.7,.2,1), transform .55s cubic-bezier(.2,.7,.2,1); }
        .landing-page.reveal-ready [data-reveal][data-revealed="true"] { opacity: 1; transform: translate3d(0, 0, 0); }
        .landing-page.reveal-ready [data-reveal-delay="1"] { transition-delay: 80ms; }
        .landing-page.reveal-ready [data-reveal-delay="2"] { transition-delay: 150ms; }
        .landing-page.reveal-ready [data-reveal-delay="3"] { transition-delay: 220ms; }
        html { scroll-behavior: smooth; scroll-padding-top: 5rem; }
        @media (prefers-reduced-motion: reduce) { .data-flow-path, .data-flow-dot, .flow-step-content, .signal-detail { animation: none; } .landing-page.reveal-ready [data-reveal] { opacity: 1; transform: none; transition: none; } html { scroll-behavior: auto !important; } }
      `}</style>

      <div ref={mainRef} className="landing-page">
      <header className="sticky top-0 z-30 border-b border-[#e3e8e2]/90 bg-[#f6f7f4]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <nav aria-label="Page sections" className="hidden items-center gap-7 sm:flex">
            <a href="#journey" className="text-xs font-medium text-slate-600 no-underline transition-colors hover:text-[#154e49] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">How it works</a>
            <a href="#mvp" className="text-xs font-medium text-slate-600 no-underline transition-colors hover:text-[#154e49] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">MVP features</a>
            <a href="#impact" className="text-xs font-medium text-slate-600 no-underline transition-colors hover:text-[#154e49] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">Impact</a>
            <a href="#about" className="text-xs font-medium text-slate-600 no-underline transition-colors hover:text-[#154e49] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">About us</a>
          </nav>
          <Link href="/login" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-[#154e49] px-3.5 text-xs font-semibold text-white no-underline transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#103e3a] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154e49] focus-visible:ring-offset-2 sm:h-11 sm:px-4 sm:text-sm">
            Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1240px] items-start gap-8 px-5 pb-14 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-[.86fr_1.14fr] lg:gap-12 lg:pb-32 lg:pt-14">
        <section className="flex min-h-[310px] min-w-0 flex-col justify-center pb-3 sm:min-h-[360px] lg:col-start-1 lg:row-start-1 lg:min-h-[430px] lg:pb-0" aria-labelledby="hero-heading">
          <p data-reveal className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#286a62] sm:text-[11px]"><span className="h-px w-7 bg-[#286a62]" aria-hidden="true" />Campus success, made visible</p>
          <h1 data-reveal data-reveal-delay="1" id="hero-heading" className="max-w-[12ch] text-[clamp(2.35rem,6.2vw,4.2rem)] font-semibold leading-[1.02] tracking-[-.055em] text-[#172824]">See student needs clearly. Act sooner.</h1>
          <p data-reveal data-reveal-delay="2" className="mt-5 max-w-[500px] text-[15px] leading-6 text-slate-600 sm:mt-6 sm:text-base sm:leading-7">Elevra connects seven campus data sources, explains why a student may need a check-in, and helps turn that signal into a practical next step.</p>
          <div data-reveal data-reveal-delay="3" className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-5">
            <a href="#journey" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#154e49] px-5 text-sm font-semibold text-white no-underline transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#103e3a] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154e49] focus-visible:ring-offset-2 sm:min-w-[210px]">Explore how it works <ArrowDown className="h-4 w-4" aria-hidden="true" /></a>
            <p className="min-w-0 text-center text-[11px] text-slate-500 sm:max-w-[160px] sm:text-left">A campus support platform, grounded in data.</p>
          </div>
        </section>

        <aside className="z-20 min-w-0 lg:sticky lg:top-[88px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-5 lg:self-start" aria-label="Interactive product illustration">
          <FlowIllustration step={activeStep} signal={activeSignal} onSignalChange={setActiveSignal} />
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-[10px] text-slate-500"><span>Illustrative product flow</span><span className="hidden sm:inline">Scroll the story to explore</span></div>
        </aside>

        <section id="journey" className="scroll-mt-24 min-w-0 lg:col-start-1 lg:row-start-2" aria-label="How Elevra works">
          <div data-reveal className="mb-5 flex items-center gap-3 border-b border-[#dfe6df] pb-3"><span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">The product flow</span><span className="h-px flex-1 bg-[#dfe6df]" /><span className="text-[10px] tabular-nums text-slate-500">0{activeStep} / 03</span></div>
          {STORY.map((item) => (
            <article key={item.id} data-journey-step={item.id} className="journey-panel flex min-h-[270px] flex-col justify-center border-t py-8 sm:min-h-[310px] sm:py-10 lg:min-h-[clamp(500px,72svh,760px)] lg:border-t-0 lg:py-12">
              <div data-reveal className="flex items-center gap-3"><span aria-current={activeStep === item.id ? "step" : undefined} className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors ${activeStep === item.id ? "border-[#b8cec3] bg-[#eaf2ed] text-[#1c564c]" : "border-[#dfe6df] text-slate-500"}`}>{String(item.id).padStart(2, "0")}</span><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#286a62]">{item.eyebrow}</p></div>
              <h2 data-reveal data-reveal-delay="1" className="mt-5 max-w-[18ch] text-[clamp(1.65rem,3.2vw,2.45rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#172824]">{item.title}</h2>
              <p data-reveal data-reveal-delay="2" className="mt-4 max-w-[520px] text-sm leading-6 text-slate-600 sm:text-[15px] sm:leading-7">{item.body}</p>
              <p data-reveal data-reveal-delay="3" className="mt-4 flex items-center gap-2 text-xs font-medium text-[#286a62]"><Check className="h-4 w-4" aria-hidden="true" />{item.note}</p>
            </article>
          ))}
        </section>
      </div>

      <section id="mvp" className="scroll-mt-20 border-y border-[#e0e6e1] bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-16">
            <div className="max-w-md">
              <p data-reveal className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#286a62]">The MVP</p>
              <h2 data-reveal data-reveal-delay="1" className="mt-3 text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#172824]">Built to move from data to action.</h2>
              <p data-reveal data-reveal-delay="2" className="mt-4 text-sm leading-6 text-slate-600">The first release focuses on the parts that make student support understandable and usable day to day.</p>
            </div>
            <div className="divide-y divide-[#e8ece8] border-y border-[#e8ece8]">
              {MVP.map(({ icon: Icon, title, detail }, index) => <article key={title} data-reveal data-reveal-delay={String(Math.min(index % 3 + 1, 3))} className="grid gap-2 py-4 transition-colors hover:bg-[#fbfcfa] sm:grid-cols-[34px_1fr] sm:gap-4 sm:px-3 sm:py-5">
                <span className="hidden h-8 w-8 place-items-center rounded-lg bg-[#edf4ef] text-[#286a62] sm:grid"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="flex items-start gap-2 sm:block"><span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#6b9284] sm:hidden">0{index + 1}</span><div><h3 className="text-sm font-semibold text-[#172824]">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{detail}</p></div></div>
              </article>)}
            </div>
          </div>
        </div>
      </section>

      <section id="impact" className="scroll-mt-20">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-16">
          <div>
            <p data-reveal className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#286a62]">Why it matters</p>
            <h2 data-reveal data-reveal-delay="1" className="mt-3 max-w-[15ch] text-[clamp(1.9rem,4.4vw,3.1rem)] font-semibold leading-[1.05] tracking-[-.05em] text-[#172824]">Earlier visibility. More useful conversations.</h2>
          </div>
          <div className="border-l-2 border-[#a8c4b5] pl-5 sm:pl-7">
            <p data-reveal className="max-w-[620px] text-base leading-7 text-slate-700 sm:text-lg sm:leading-8">Instead of waiting for final marks, Elevra brings attendance, learning activity, internal scores and backlogs together while the semester is still underway. Each risk signal shows why a student may need a check-in.</p>
            <p data-reveal data-reveal-delay="1" className="mt-4 max-w-[620px] text-sm leading-6 text-slate-500">That gives mentors a starting point for a timely conversation and gives students focused next steps. The score is guidance; it does not label a student or promise an outcome.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#173f38] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-8 sm:py-12 md:flex-row md:items-center md:justify-between">
          <div data-reveal><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#b6d8c8]">See Elevra in action</p><h2 data-reveal data-reveal-delay="1" className="mt-2 max-w-[24ch] text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight tracking-[-.04em]">A clearer view can change what happens next.</h2></div>
          <div data-reveal data-reveal-delay="2"><Link href="/login" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#173f38] no-underline transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#eaf2ed] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#173f38]">Explore the workspace <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section id="about" className="scroll-mt-20 border-t border-[#e0e6e1] bg-white" aria-labelledby="about-heading">
        <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 sm:py-20">
          <p data-reveal className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#286a62]">About us</p>
          <h2 data-reveal data-reveal-delay="1" id="about-heading" className="mt-3 max-w-[16ch] text-[clamp(1.8rem,4vw,2.8rem)] font-semibold leading-[1.08] tracking-[-.045em] text-[#172824]">The team behind Elevra.</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {TEAM.map((person, index) => (
              <li key={person.name} data-reveal data-reveal-delay={String(index + 1)} className="flex min-w-0 flex-col items-start gap-4 rounded-2xl border border-[#dbe5df] bg-[#fafbf9] p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#eaf2ed] text-sm font-semibold text-[#286a62]">{person.initials}</span>
                  <h3 className="min-w-0 text-base font-semibold leading-tight tracking-[-.025em] text-[#172824]">{person.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={person.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn (opens in a new tab)`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#dbe5df] bg-white px-3.5 text-xs font-semibold text-[#154e49] no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:bg-[#f5f8f5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 motion-reduce:transform-none">
                    <Linkedin className="h-4 w-4" aria-hidden="true" />LinkedIn
                  </a>
                  <a href={person.github} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on GitHub (opens in a new tab)`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#dbe5df] bg-white px-3.5 text-xs font-semibold text-[#154e49] no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:bg-[#f5f8f5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 motion-reduce:transform-none">
                    <Github className="h-4 w-4" aria-hidden="true" />GitHub
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer data-reveal className="mx-auto flex max-w-[1240px] flex-col gap-2 border-t border-[#e0e6e1] px-5 py-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>Elevra.ai · Student success intelligence · <a href="#about" className="underline decoration-slate-300 underline-offset-4 hover:text-[#154e49]">About us</a></span><span>Scores are guidance signals, shown with their drivers and available data.</span></footer>
      </div>
    </main>
  );
}
