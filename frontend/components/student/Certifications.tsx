"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, Search, X } from "lucide-react";
import { ProfileGate } from "./ProfileGate";
import { StudentReveal } from "./StudentReveal";
import { CERTIFICATIONS, PILLAR_LABEL, type Certification } from "./playbook";
import { weakestPillars } from "./weakest";

type ViewMode = "grid" | "list";
type CourseResult = { course: Certification; relevant: boolean };
type Provider = Certification["provider"] | "All providers";
type Topic = string;

const PROVIDER_SURFACE: Record<Certification["provider"], string> = {
  Coursera: "border-[#d5e5dc] bg-[#f5f9f6]",
  Udemy: "border-[#ebd9cb] bg-[#fff8f2]",
  NPTEL: "border-[#eadfbe] bg-[#fffaf0]",
};

function CourseCard({ course, compact = false }: CourseResult & { compact?: boolean }) {
  return (
    <article className={`group rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none ${PROVIDER_SURFACE[course.provider]} ${compact ? "flex items-center gap-4 p-4" : "flex h-full flex-col p-4"}`}>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug text-[#172824]">{course.title}</h3>
        <p className={`mt-2 text-sm leading-5 text-slate-600 ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{course.description}</p>
      </div>
      <a href={course.url} target="_blank" rel="noopener noreferrer"
        aria-label={`Explore ${course.title}`}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white/80 px-3 text-sm font-semibold text-[#18574e] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] ${compact ? "shrink-0" : "mt-5 w-fit"}`}>
        Explore <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Course display" className="flex rounded-lg border border-[#dce7e1] bg-white p-1">
      <button type="button" onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label="Show courses as cards"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "grid" ? "bg-[#eaf3ef] text-[#18574e]" : "text-slate-500 hover:bg-slate-50"}`}>
        <LayoutGrid className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Cards</span>
      </button>
      <button type="button" onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label="Show courses as a list"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "list" ? "bg-[#eaf3ef] text-[#18574e]" : "text-slate-500 hover:bg-slate-50"}`}>
        <ListIcon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}

export function Certifications() {
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [provider, setProvider] = useState<Provider>("All providers");
  const [topic, setTopic] = useState<Topic>("All topics");
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <ProfileGate>
      {(profile) => {
        const weak = weakestPillars(profile).map(({ pillar }) => pillar);
        const departmentItems: CourseResult[] = CERTIFICATIONS
          .filter((course) => course.departments.length === 0 || course.departments.includes(profile.department))
          .map((course) => ({ course, relevant: course.skills.some((skill) => weak.includes(skill)) }));
        const topics = Array.from(new Set(departmentItems.map(({ course }) => course.tag))).sort((a, b) => a.localeCompare(b));
        const providers = Array.from(new Set(departmentItems.map(({ course }) => course.provider))).sort((a, b) => a.localeCompare(b));
        const results = departmentItems
          .filter(({ course }) => provider === "All providers" || course.provider === provider)
          .filter(({ course }) => topic === "All topics" || course.tag === topic)
          .filter(({ course }) => !query || `${course.title} ${course.description} ${course.provider} ${course.tag} ${course.skills.map((skill) => PILLAR_LABEL[skill]).join(" ")}`.toLowerCase().includes(query))
          .sort((a, b) => Number(b.relevant) - Number(a.relevant) || a.course.title.localeCompare(b.course.title));
        const filtered = Boolean(query || provider !== "All providers" || topic !== "All topics");
        const submitSearch = (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setQuery(searchText.trim().toLowerCase());
        };
        const clearFilters = () => { setSearchText(""); setQuery(""); setProvider("All providers"); setTopic("All topics"); };
        const resultKey = `${query}-${provider}-${topic}-${view}`;

        return (
          <div className="space-y-4">
            <section aria-label="Find a certification" className="rounded-xl border border-[#dce7e1] bg-[#f1f6f3] p-3 sm:p-4">
              <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search courses</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search skills, courses, or providers"
                    className="h-11 w-full rounded-lg border border-[#dce7e1] bg-white pl-9 pr-3 text-sm text-[#172824] outline-none transition focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15" />
                </label>
                <button type="submit" className="h-11 rounded-lg bg-[#18574e] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#12473f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">Search</button>
              </form>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Filter by provider</span>
                  <select value={provider} onChange={(event) => setProvider(event.target.value as Provider)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15">
                    <option>All providers</option>{providers.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Filter by topic</span>
                  <select value={topic} onChange={(event) => setTopic(event.target.value)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15">
                    <option>All topics</option>{topics.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </label>
                {filtered && <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-[#286a62] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]"><X className="h-4 w-4" aria-hidden="true" />Clear</button>}
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-sm text-slate-600"><span className="font-semibold text-[#172824]">{results.length}</span> courses for {profile.department}</p>
              <ViewToggle value={view} onChange={setView} />
            </div>

            {results.length ? (
              <ul className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"} aria-label="Certification results">
                {results.map((item, index) => (
                  <li key={item.course.title}>
                    <StudentReveal key={`${resultKey}-${item.course.title}`} delayMs={Math.min(index, 8) * 45} className="h-full">
                      <CourseCard {...item} compact={view === "list"} />
                    </StudentReveal>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-[#dce7e1] bg-white px-5 py-10 text-center">
                <p className="font-medium text-[#172824]">No courses match those filters</p>
                <p className="mt-1 text-sm text-slate-500">Try another search or clear the filters.</p>
                <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#286a62] underline underline-offset-2">Clear filters</button>
              </div>
            )}
          </div>
        );
      }}
    </ProfileGate>
  );
}
