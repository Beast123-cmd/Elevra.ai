import Link from "next/link";
import { ArrowRight, Check, CircleDot, GraduationCap, Layers3, ScanLine } from "lucide-react";

const SIGNALS = ["Academics", "Attendance", "Learning", "Engagement", "Skills", "Activities", "Placement"];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f7f4] text-slate-950">
      <header className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-slate-950 no-underline" aria-label="Elevra home">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#154e49] text-base font-semibold text-white">e</span>
          <span className="text-[17px] font-bold tracking-[-.04em]">elevra<span className="font-medium text-slate-500">.ai</span></span>
        </Link>
        <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-md bg-[#154e49] px-4 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#103e3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154e49] focus-visible:ring-offset-2">
          Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[.92fr_1.08fr] lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="max-w-[540px]">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[#286a62]">
            <span className="h-px w-7 bg-[#286a62]" aria-hidden="true" /> Student success, seen clearly
          </p>
          <h1 className="max-w-[12ch] text-[clamp(2.4rem,7.2vw,4rem)] font-semibold leading-[1.04] tracking-[-.055em] text-[#172824]">
            Better support starts with the full picture.
          </h1>
          <p className="mt-6 max-w-[480px] text-[16px] leading-7 text-slate-600 sm:text-[17px]">
            Elevra brings campus signals together, explains what may need attention, and helps students and mentors choose a useful next step.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link href="/login" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#154e49] px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#103e3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154e49] focus-visible:ring-offset-2 sm:w-auto">
              Open your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="text-xs leading-5 text-slate-500">For students, faculty mentors and campus teams</p>
          </div>
        </div>

        <div className="relative min-w-0" aria-label="How Elevra turns campus records into a clear next step">
          <div className="absolute -inset-4 -z-10 rounded-[28px] bg-[#e8eeea] sm:-inset-6" aria-hidden="true" />
          <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-[0_18px_50px_-34px_rgba(23,40,36,.35)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf4f1] text-[#286a62]"><Layers3 className="h-4 w-4" aria-hidden="true" /></span>
                <div><p className="text-xs font-semibold text-slate-800">One student view</p><p className="mt-0.5 text-[10px] text-slate-500">Signals connected with context</p></div>
              </div>
              <span className="rounded-full border border-[#dbe9e2] bg-[#f2f7f3] px-2.5 py-1 text-[10px] font-medium text-[#286a62]">Illustrative</span>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_34px_1fr] sm:items-center sm:gap-3 sm:p-7">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">Campus signals</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIGNALS.map((signal, index) => (
                    <div key={signal} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-100 bg-[#fafbf9] px-2.5 py-2 text-[11px] font-medium text-slate-700">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${index % 2 ? "bg-[#a9b8ad]" : "bg-[#4b8175]"}`} aria-hidden="true" />{signal}
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden justify-center text-[#789087] sm:flex"><ArrowRight className="h-5 w-5" aria-hidden="true" /></div>
              <div className="flex justify-center text-[#789087] sm:hidden"><ArrowRight className="h-5 w-5 rotate-90" aria-hidden="true" /></div>
              <div className="rounded-lg bg-[#183d37] p-4 text-white sm:p-5">
                <div className="flex items-center gap-2 text-[10px] font-medium text-[#c7ddd3]"><GraduationCap className="h-4 w-4" aria-hidden="true" /> Student context</div>
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-start gap-2.5 rounded-md bg-white/[.08] p-3"><ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-[#b4d7c8]" aria-hidden="true" /><div><p className="text-xs font-semibold">Progress with context</p><p className="mt-1 text-[10px] leading-4 text-[#c7d7d1]">A score with its available data and drivers.</p></div></div>
                  <div className="flex items-start gap-2.5 rounded-md bg-white/[.08] p-3"><CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-[#b4d7c8]" aria-hidden="true" /><div><p className="text-xs font-semibold">A timely check-in</p><p className="mt-1 text-[10px] leading-4 text-[#c7d7d1]">A clear signal for a helpful conversation.</p></div></div>
                  <div className="flex items-start gap-2.5 rounded-md bg-white/[.08] p-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#b4d7c8]" aria-hidden="true" /><div><p className="text-xs font-semibold">A practical next step</p><p className="mt-1 text-[10px] leading-4 text-[#c7d7d1]">Guidance shaped around student needs.</p></div></div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-[10px] leading-4 text-slate-500 sm:px-7">Scores are guidance signals. They are shown with their drivers and available data.</div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e1e6e1] bg-white">
        <div className="mx-auto grid max-w-[1240px] divide-y divide-[#e7ebe7] px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            ["Students", "Understand your progress and find a manageable next step."],
            ["Faculty mentors", "See which mentees may need a check-in, and why."],
            ["Campus teams", "Review cohort patterns and follow support activity."],
          ].map(([title, copy]) => (
            <div key={title} className="py-5 md:px-6 md:py-6 first:md:pl-0 last:md:pr-0">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#286a62]">{title}</p>
              <p className="mt-2 max-w-[290px] text-sm leading-5 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Elevra.ai · Student success intelligence</span><span>Built around clarity, context and timely support</span>
      </footer>
    </main>
  );
}
