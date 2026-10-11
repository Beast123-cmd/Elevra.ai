"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, Search, Trophy, X } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileGate } from "../ProfileGate";
import { StudentReveal } from "../StudentReveal";
import { HACKATHONS, type Hackathon, type HackathonKind } from "./data";
import { matchesEveryWord } from "../catalogSearch";

type Scope = "branch" | "all";
type ViewMode = "grid" | "list";
type KindFilter = HackathonKind | "All types";

const EVENT_SURFACE: Record<HackathonKind, string> = {
  National: "border-[#eadfbe] bg-[#fffaf0]",
  Global: "border-[#d5e5dc] bg-[#f5f9f6]",
  Platform: "border-[#ead9cd] bg-[#fff8f2]",
  "Coding contest": "border-[#cfe3dc] bg-[#f2f8f5]",
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

function EventCard({ event, compact = false }: { event: Hackathon; compact?: boolean }) {
  return (
    <article className={`group rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none ${EVENT_SURFACE[event.kind]} ${compact ? "flex items-center gap-4 p-4" : "flex h-full flex-col p-4"}`}>
      <div className="min-w-0 flex-1">
        <span className="mb-2 inline-flex rounded-full border border-current/15 bg-white/75 px-2.5 py-1 text-xs font-semibold text-[#286a62]">{event.organiser}</span>
        <h3 className="font-semibold leading-snug text-[#172824]">{event.name}</h3>
        <p className={`mt-2 text-sm leading-5 text-slate-600 ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{event.about}</p>
      </div>
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        aria-label={`Explore ${event.name}`}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white/80 px-3 text-sm font-semibold text-[#18574e] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] ${compact ? "shrink-0" : "mt-5 w-fit"}`}>
        Explore <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
    .filter((event) => matchesEveryWord(query, `${event.name} ${event.organiser} ${event.kind} ${event.format} ${event.focus.join(" ")} ${event.about}`))
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

      <p aria-live="polite" className="-mb-2 text-sm text-slate-600"><span className="font-semibold text-[#172824]">{events.length}</span> events for {profile.department}</p>
      {events.length ? (
        <ul className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"} aria-label="Hackathon results">
          {events.map((event, index) => (
            <li key={event.name}>
              <StudentReveal key={`${query}-${scope}-${kind}-${format}-${view}-${event.name}`} delayMs={Math.min(index, 8) * 45} className="h-full">
                <EventCard event={event} compact={view === "list"} />
              </StudentReveal>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-[#dce7e1] bg-white px-5 py-10 text-center">
          <p className="font-medium text-[#172824]">No events found</p>
          {filtered && <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#286a62] underline underline-offset-2">Clear filters</button>}
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
          <h2 className="text-lg font-bold leading-tight tracking-tight text-[#172824]">Hackathons</h2>
          <YourRecord profile={profile} />
          <EventCatalog profile={profile} />
        </div>
      )}
    </ProfileGate>
  );
}
