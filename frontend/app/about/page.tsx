import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Github, Linkedin } from "lucide-react";
import { Brand } from "@/components/shared/Brand";

export const metadata: Metadata = {
  title: "About us | Elevra.ai",
  description: "The three people who built Elevra, with their LinkedIn and GitHub profiles.",
};

const TEAM = [
  {
    name: "Utkarsh Waghmare",
    initials: "UW",
    role: "Student experience & insights",
    summary: "Built the student workspace: the improvement plan, what-if exploration, hackathons, certifications and the voice mock interview, plus the data-health and method pages.",
    linkedin: "https://www.linkedin.com/in/utkarsh-waghmare-39a068254/",
    github: "https://github.com/beutkarshh",
  },
  {
    name: "Aayush Angal",
    initials: "AA",
    role: "Data pipeline & scoring engine",
    summary: "Built the data foundation: cleaning and merging seven messy sources into one student record, the explainable success score, the risk model and the database.",
    linkedin: "https://www.linkedin.com/in/aayushangal/",
    github: "https://github.com/Beast123-cmd",
  },
  {
    name: "Mahesh Loya",
    initials: "ML",
    role: "Admin, faculty & platform",
    summary: "Built the admin and faculty dashboards, the mentor briefs, the API behind the whole product, and the deployment that keeps it running.",
    linkedin: "https://www.linkedin.com/in/maheshloya/",
    github: "https://github.com/Mahesh-Loya",
  },
] as const;

const NAV_LINK = "text-xs font-medium text-slate-600 no-underline transition-colors hover:text-[#154e49] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]";
const PROFILE_LINK = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#dbe5df] bg-white px-3.5 text-xs font-semibold text-[#154e49] no-underline transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:bg-[#f5f8f5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 motion-reduce:transform-none";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f4] text-slate-950">
      <div className="landing-page">
        <header className="sticky top-0 z-30 border-b border-[#e3e8e2]/90 bg-[#f6f7f4]/95 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
            <Brand />
            <nav aria-label="Site" className="hidden items-center gap-7 sm:flex">
              <Link href="/" className={NAV_LINK}>Home</Link>
              <Link href="/about" aria-current="page" className={`${NAV_LINK} !text-[#154e49]`}>About us</Link>
            </nav>
            <Link href="/login" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-[#154e49] px-3.5 text-xs font-semibold text-white no-underline transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#103e3a] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#154e49] focus-visible:ring-offset-2 sm:h-11 sm:px-4 sm:text-sm">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-[1240px] px-5 pb-10 pt-10 sm:px-8 sm:pb-14 sm:pt-16" aria-labelledby="about-heading">
          <p className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#286a62] sm:text-[11px]"><span className="h-px w-7 bg-[#286a62]" aria-hidden="true" />About us</p>
          <h1 id="about-heading" className="max-w-[16ch] text-[clamp(2.1rem,5.4vw,3.6rem)] font-semibold leading-[1.04] tracking-[-.055em] text-[#172824]">Three builders. One platform for student success.</h1>
          <p className="mt-5 max-w-[560px] text-[15px] leading-6 text-slate-600 sm:text-base sm:leading-7">
            Elevra brings seven campus data sources together, explains why a student may need a check-in, and helps turn that signal into a useful next step. We designed, built and deployed it as a team of three.
          </p>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 pb-14 sm:px-8 sm:pb-24" aria-label="The team">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {TEAM.map((person) => (
              <li key={person.name} className="flex min-w-0 flex-col rounded-2xl border border-[#dbe5df] bg-white p-5 shadow-[0_28px_90px_-62px_rgba(16,55,47,.42)] sm:p-6">
                <div className="flex items-center gap-4">
                  <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#eaf2ed] text-base font-semibold tracking-[-.02em] text-[#286a62]">{person.initials}</span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight tracking-[-.03em] text-[#172824]">{person.name}</h2>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">{person.role}</p>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{person.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <a href={person.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn (opens in a new tab)`} className={PROFILE_LINK}>
                    <Linkedin className="h-4 w-4" aria-hidden="true" />LinkedIn
                  </a>
                  <a href={person.github} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on GitHub (opens in a new tab)`} className={PROFILE_LINK}>
                    <Github className="h-4 w-4" aria-hidden="true" />GitHub
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-[#173f38] text-white">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 sm:px-8 sm:py-12 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#b6d8c8]">See Elevra in action</p>
              <h2 className="mt-2 max-w-[24ch] text-[clamp(1.5rem,3.5vw,2.25rem)] font-semibold leading-tight tracking-[-.045em] text-white">Sign in to explore the student, faculty and admin workspaces.</h2>
            </div>
            <Link href="/login" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#173f38] no-underline transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#eef5f0] hover:shadow-lg active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#173f38] motion-reduce:transform-none">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1240px] flex-col gap-2 border-t border-[#e0e6e1] px-5 py-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Elevra.ai · Student success intelligence</span>
          <Link href="/" className="no-underline hover:text-[#154e49]">Back to Elevra</Link>
        </footer>
      </div>
    </main>
  );
}
