"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, Search, Trophy, X } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileGate } from "../ProfileGate";
import { StudentReveal } from "../StudentReveal";
import { HACKATHONS, type Hackathon, type HackathonKind } from "./data";

type Scope = "branch" | "all";
type ViewMode = "grid" | "list";
type KindFilter = HackathonKind | "All types";

const KIND_TONE: Record<HackathonKind, { chip: string; stripe: string }> = {
  National: { chip: "bg-amber-50 text-amber-900 ring-amber-100", stripe: "bg-amber-400" },
  Global: { chip: "bg-blue-50 text-blue-800 ring-blue-100", stripe: "bg-blue-400" },
  Platform: { chip: "bg-violet-50 text-violet-800 ring-violet-100", stripe: "bg-violet-400" },
  "Coding contest": { chip: "bg-[#eaf3ef] text-[#18574e] ring-[#d3e7dd]", stripe: "bg-[#398b7d]" },
};

const suits = (h: Hackathon, dept: string) => h.departments.length === 0 || h.departments.includes(dept);

function YourRecord({ profile }: { profile: Profile }) {
  const count = Number(profile.metrics.hackathons ?? 0);
  return (
    <Card className="rounded-xl border-[#dce7e1] bg-[#fff7e8] shadow-none">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><Trophy className="h-4 w-4" aria-hidden="true" /></span>
        <p className="text-sm text-slate-700"><span className="font-semibold tabular-nums text-[#172824]">{count}</span> verified hackathon{count === 1 ? "" : "s"} on your record</p>
        <span className="ml-auto hidden text-xs text-slate-500 sm:block">Share participation proof with your mentor to add it</span>
      </CardContent>
    </Card>
  );
}

function EventCard({ event, department, compact = false }: { event: Hackathon; department: string; compact?: boolean }) {
  const tone = KIND_TONE[event.kind];
  return (
    <article className={`group relative overflow-hidden rounded-xl border border-[#dce7e1] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#b7d1c8] hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none ${compact ? "flex items-center gap-4 p-4" : "flex h-full flex-col p-4"}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${tone.stripe}`} aria-hidden="true" />
      <div className={`min-w-0 flex-1 ${compact ? "flex flex-wrap items-center gap-x-4 gap-y-2" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone.chip}`}>{event.kind}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{event.format}</span>
          {event.departments.length > 0 && suits(event, department) && <span className="rounded-full bg-[#eff8f5] px-2.5 py-1 text-[11px] font-medium text-[#286a62]">For {department}</span>}
        </div>
        <h3 className={`mt-3 font-semibold leading-snug text-[#172824] ${compact ? "mt-0 min-w-[220px] flex-1 text-sm" : "text-base"}`}>{event.name}</h3>
        <p className="mt-1 text-xs text-slate-500">{event.organiser}</p>
        <p className={`mt-2 text-sm leading-5 text-slate-600 ${compact ? "line-clamp-2 text-xs" : "mt-3"}`}>{event.about}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.focus.map((focus) => <span key={focus} className="rounded-md bg-[#f3f6f9] px-2 py-1 text-[11px] text-slate-600">{focus}</span>)}
        </div>
      </div>
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#eaf3ef] px-3 text-sm font-semibold text-[#18574e] transition-colors hover:bg-[#dcece4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] ${compact ? "shrink-0" : "mt-4 w-full"}`}>
        Official site <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Event display" className="flex rounded-lg border border-[#dce7e1] bg-white p-1">
      <button type="button" onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label="Show events as cards"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "grid" ? "bg-[#eaf3ef] text-[#18574e]" : "text-slate-500 hover:bg-slate-50"}`}>
        <LayoutGrid className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Cards</span>
      </button>
      <button type="button" onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label="Show events as a list"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "list" ? "bg-[#eaf3ef] text-[#18574e]" : "text-slate-500 hover:bg-slate-50"}`}>
        <ListIcon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}

function EventCatalog({ profile }: { profile: Profile }) {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("branch");
  const [kind, setKind] = useState<KindFilter>("All types");
  const [format, setFormat] = useState<Hackathon["format"] | "Any format">("Any format");
  const [view, setView] = useState<ViewMode>("grid");
  const kinds = Array.from(new Set(HACKATHONS.map(({ kind: eventKind }) => eventKind))).sort((a, b) => a.localeCompare(b));
  const formats = Array.from(new Set(HACKATHONS.map(({ format: eventFormat }) => eventFormat))).sort((a, b) => a.localeCompare(b));
  const events = HACKATHONS
    .filter((event) => scope === "all" || suits(event, profile.department))
    .filter((event) => kind === "All types" || event.kind === kind)
    .filter((event) => format === "Any format" || event.format === format)
    .filter((event) => !query || `${event.name} ${event.organiser} ${event.kind} ${event.format} ${event.focus.join(" ")} ${event.about}`.toLowerCase().includes(query))
    .sort((a, b) => Number(suits(b, profile.department)) - Number(suits(a, profile.department)) || a.name.localeCompare(b.name));
  const filtered = Boolean(query || scope === "all" || kind !== "All types" || format !== "Any format");
  const submitSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setQuery(searchText.trim().toLowerCase()); };
  const clearFilters = () => { setSearchText(""); setQuery(""); setScope("branch"); setKind("All types"); setFormat("Any format"); };

  return (
    <div className="space-y-4">
      <section aria-label="Find an event" className="rounded-xl border border-[#dce7e1] bg-[#f1f6f3] p-3 sm:p-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search hackathons and contests</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search events, organisers, or skills"
              className="h-11 w-full rounded-lg border border-[#dce7e1] bg-white pl-9 pr-3 text-sm text-[#172824] outline-none transition focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15" />
          </label>
          <button type="submit" className="h-11 rounded-lg bg-[#18574e] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#12473f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">Search</button>
        </form>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label>
            <span className="sr-only">Filter by event type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15">
              <option>All types</option>{kinds.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by participation format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15">
              <option>Any format</option>{formats.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Event relevance" className="flex rounded-lg bg-[#edf2ef] p-1">
            {(["branch", "all"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
                className={`min-h-9 rounded-md px-3 text-xs transition-colors ${scope === value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                {value === "branch" ? `For ${profile.department}` : "All events"}
              </button>
            ))}
          </div>
          {filtered && <button type="button" onClick={clearFilters} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-[#286a62] hover:bg-[#edf5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]"><X className="h-4 w-4" aria-hidden="true" />Clear</button>}
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <p aria-live="polite" className="-mb-2 text-sm text-slate-600"><span className="font-semibold text-[#172824]">{events.length}</span> events{!filtered && <span className="text-slate-500"> · relevant to your branch first</span>}</p>
      {events.length ? (
        <StudentReveal key={`${query}-${scope}-${kind}-${format}-${view}`}>
          {view === "grid" ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Hackathon results">
              {events.map((event) => <li key={event.name}><EventCard event={event} department={profile.department} /></li>)}
            </ul>
          ) : (
            <ul className="space-y-2" aria-label="Hackathon results">
              {events.map((event) => <li key={event.name}><EventCard event={event} department={profile.department} compact /></li>)}
            </ul>
          )}
        </StudentReveal>
      ) : (
        <div className="rounded-xl border border-[#dce7e1] bg-white px-5 py-10 text-center">
          <p className="font-medium text-[#172824]">No events match those filters</p>
          <p className="mt-1 text-sm text-slate-500">Try another search or include events outside your branch.</p>
          <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#286a62] underline underline-offset-2">Clear filters</button>
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">Check official sites for current dates. Share proof of participation with your faculty mentor to add it to your record.</p>
    </div>
  );
}

export function Hackathons() {
  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-4">
          <YourRecord profile={profile} />
          <EventCatalog profile={profile} />
        </div>
      )}
    </ProfileGate>
  );
}
