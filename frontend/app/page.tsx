import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Bring records together",
    description: "Connect academic, attendance, learning and placement signals in one student view.",
  },
  {
    number: "02",
    title: "Understand what changed",
    description: "See clear drivers and missing data alongside each student success signal.",
  },
  {
    number: "03",
    title: "Make a timely check-in",
    description: "Give mentors and students practical next steps they can act on.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200">
          <Link href="/" className="flex items-center gap-2.5 text-slate-900 no-underline" aria-label="Elevra home">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-800 text-base font-semibold text-white">e</span>
            <span className="text-[17px] font-bold tracking-tight">elevra<span className="font-medium text-slate-500">.ai</span></span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-6">
            <a href="#how-it-works" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">How it works</a>
            <Link href="/login" className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-800 px-3.5 text-sm font-medium text-white no-underline transition-colors hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:gap-16 lg:py-24">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-teal-800">
              <span className="h-px w-7 bg-teal-700" aria-hidden="true" /> Campus success, made actionable
            </p>
            <h1 className="max-w-[620px] text-[40px] font-semibold leading-[1.08] tracking-[-.045em] text-slate-950 sm:text-[54px]">
              See the whole picture. Make the next step clear.
            </h1>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-slate-600 sm:text-[17px]">
              Elevra brings student signals into one place, so campus teams can spot when someone may need a check-in and help students find a practical path forward.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-md bg-teal-800 px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                Open your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className="inline-flex h-11 items-center gap-1 text-sm font-medium text-slate-700 no-underline hover:text-teal-900">
                How Elevra works <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <p className="mt-5 text-xs text-slate-500">For students, faculty mentors and campus teams.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">A connected support workflow</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">From campus records to a useful next step</p>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-800" aria-hidden="true">
                <Check className="h-4 w-4" />
              </span>
            </div>
            <ol className="divide-y divide-slate-100">
              {STEPS.map((step) => (
                <li key={step.number} className="flex gap-4 py-5 last:pb-1">
                  <span className="pt-0.5 font-mono text-xs text-teal-800">{step.number}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-slate-200 py-8 sm:py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Built for the people who support students</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">One view, with a clear purpose.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">Scores are guidance signals. Each view keeps its drivers and available data in context.</p>
          </div>
          <div className="mt-6 grid gap-3 pb-12 sm:grid-cols-3 sm:pb-14">
            {[
              ["For students", "See your progress and choose a manageable next step."],
              ["For mentors", "Find mentees who may benefit from a check-in and understand why."],
              ["For campus teams", "Review cohort patterns and follow support activity."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Elevra.ai · Student success intelligence</span>
          <Link href="/login" className="font-medium text-teal-800 no-underline hover:text-teal-900">Sign in to your workspace</Link>
        </footer>
      </div>
    </main>
  );
}
