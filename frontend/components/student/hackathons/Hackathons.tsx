"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, MapPin, RefreshCw, Search, Trophy, Users } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileGate } from "../ProfileGate";
import { StudentReveal } from "../StudentReveal";
import { HACKATHONS, type Hackathon, type HackathonKind } from "./data";
import { matchesEveryWord } from "../catalogSearch";
import { ago, countdown, loadFeed, type HackathonFeed, type LiveHackathon } from "./live";

type Scope = "branch" | "all";
type ViewMode = "grid" | "list";
type KindFilter = "All types" | "Hackathons" | "Coding contests";
type FormatFilter = "Any format" | "Team" | "Solo";

function matchesFormatFilter(filter: FormatFilter, format: Hackathon["format"] | LiveHackathon["team"]): boolean {
  if (filter === "Any format") return true;
  if (!format) return false;
  if (format === "Team or solo") return true;
  if (format === "Solo" || format === "1") return filter === "Solo";
  if (/^1\s*[-–—]\s*\d+/.test(format)) return true;
  return filter === "Team";
}

const EVENT_SURFACE: Record<HackathonKind, string> = {
  National: "border-[#eadfbe] bg-[#fffaf0] dark:border-[#665332] dark:bg-[#29271f]",
  Global: "border-[#d5e5dc] bg-[#f5f9f6] dark:border-[#3c5b50] dark:bg-[#202d28]",
  Platform: "border-[#ead9cd] bg-[#fff8f2] dark:border-[#694b3a] dark:bg-[#30251f]",
  "Coding contest": "border-[#cfe3dc] bg-[#f2f8f5] dark:border-[#3c5b50] dark:bg-[#202d28]",
};

const suits = (h: Hackathon, dept: string) => h.departments.length === 0 || h.departments.includes(dept);

function YourRecord({ profile }: { profile: Profile }) {
  const count = Number(profile.metrics.hackathons ?? 0);
  return (
    <Card className="rounded-xl border-[#eadfbe] bg-[#fff7e8] shadow-none dark:border-[#665332] dark:bg-[#29271f]">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><Trophy className="h-4 w-4" aria-hidden="true" /></span>
        <p className="text-sm text-slate-700 dark:text-[#d7ddd8]"><span className="font-semibold tabular-nums text-[#172824] dark:text-[#f2ead0]">{count}</span> verified hackathon{count === 1 ? "" : "s"} on your record</p>
        <span className="ml-auto hidden text-xs text-slate-500 dark:text-[#b8aa83] sm:block">Share participation proof with your mentor to add it</span>
      </CardContent>
    </Card>
  );
}

function EventCard({ event, compact = false }: { event: Hackathon; compact?: boolean }) {
  return (
    <article className={`group rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none ${EVENT_SURFACE[event.kind]} ${compact ? "flex items-center gap-4 p-4" : "flex h-full flex-col p-4"}`}>
      <div className="min-w-0 flex-1">
        <span className="mb-2 inline-flex rounded-full border border-[#c5d9cf] bg-[#eaf3ef] px-2.5 py-1 text-xs font-semibold text-[#18574e] dark:border-[#49675a] dark:bg-[#293b33] dark:text-[#c9dfd2]">{event.organiser}</span>
        <h3 className="font-semibold leading-snug text-[#172824] dark:text-[#e7eee9]">{event.name}</h3>
        <p className={`mt-2 text-sm leading-5 text-slate-600 dark:text-[#bac7c0] ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{event.about}</p>
      </div>
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        aria-label={`Explore ${event.name}`}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#f3e8c9] px-3 text-sm font-semibold text-[#705323] transition-colors hover:bg-[#eddfb9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78a3b] dark:bg-[#514327] dark:text-[#f0d99e] dark:hover:bg-[#63512e] ${compact ? "shrink-0" : "mt-5 w-fit"}`}>
        Explore <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Event display" className="flex rounded-lg border border-[#dce7e1] bg-white p-1 dark:border-[#40584d] dark:bg-[#1b2621]">
      <button type="button" onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label="Show events as cards"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "grid" ? "bg-[#eaf3ef] text-[#18574e] dark:bg-[#30463b] dark:text-[#c9dfd2]" : "text-slate-500 hover:bg-slate-50 dark:text-[#a9b9b0] dark:hover:bg-[#27352e]"}`}>
        <LayoutGrid className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Cards</span>
      </button>
      <button type="button" onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label="Show events as a list"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "list" ? "bg-[#eaf3ef] text-[#18574e] dark:bg-[#30463b] dark:text-[#c9dfd2]" : "text-slate-500 hover:bg-slate-50 dark:text-[#a9b9b0] dark:hover:bg-[#27352e]"}`}>
        <ListIcon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}

function EventCatalog({ profile, query, kind, format, scope, view }: { profile: Profile; query: string; kind: KindFilter; format: FormatFilter; scope: Scope; view: ViewMode }) {
  const events = HACKATHONS
    .filter((event) => scope === "all" || suits(event, profile.department))
    .filter((event) => kind === "All types" || (kind === "Coding contests" ? event.kind === "Coding contest" : event.kind !== "Coding contest"))
    .filter((event) => matchesFormatFilter(format, event.format))
    .filter((event) => matchesEveryWord(query, `${event.name} ${event.organiser} ${event.kind} ${event.format} ${event.focus.join(" ")} ${event.about}`))
    .sort((a, b) => Number(suits(b, profile.department)) - Number(suits(a, profile.department)) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      <p aria-live="polite" className="-mb-2 text-sm text-slate-600 dark:text-[#a9b9b0]"><span className="font-semibold text-[#172824] dark:text-[#e7eee9]">{events.length}</span> events for {profile.department}</p>
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
        <div className="rounded-xl border border-[#dce7e1] bg-white px-5 py-10 text-center dark:border-[#40584d] dark:bg-[#1d2924]">
          <p className="font-medium text-[#172824] dark:text-[#e7eee9]">No results found</p>
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">Check official sites for current dates. Share proof of participation with your faculty mentor to add it to your record.</p>
    </div>
  );
}

export function AnnualEvents() {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All types");
  const [format, setFormat] = useState<FormatFilter>("Any format");
  const [scope, setScope] = useState<Scope>("branch");
  const [view, setView] = useState<ViewMode>("grid");
  const hasFilters = Boolean(query || kind !== "All types" || format !== "Any format" || scope !== "branch");

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(searchText.trim());
  };
  const clearFilters = () => {
    setSearchText("");
    setQuery("");
    setKind("All types");
    setFormat("Any format");
    setScope("branch");
  };

  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-5">
          <section aria-label="Search annual events" className="rounded-xl border border-[#eadfbe] bg-[#fffaf0] p-3 sm:p-4 dark:border-[#665332] dark:bg-[#29271f]">
            <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search annual events and platforms</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9c7b3d] dark:text-[#cdb06d]" aria-hidden="true" />
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search events, organisers, or skills"
                  className="h-11 w-full rounded-lg border border-[#e2d4b7] bg-white pl-9 pr-3 text-sm text-[#172824] outline-none transition placeholder:text-slate-400 focus:border-[#b78a3b] focus:ring-2 focus:ring-[#b78a3b]/20 dark:border-[#665332] dark:bg-[#17231f] dark:text-[#e7eee9] dark:placeholder:text-[#84968b]" />
              </label>
              <button type="submit" className="h-11 rounded-lg bg-[#705323] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#5c431b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b78a3b] focus-visible:ring-offset-2 dark:bg-[#9d7a37] dark:hover:bg-[#b28d43]">Search</button>
            </form>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label><span className="sr-only">Filter by event type</span><select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-[#e2d4b7] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#b78a3b] focus:ring-2 focus:ring-[#b78a3b]/20 dark:border-[#665332] dark:bg-[#17231f] dark:text-[#d4ded8]"><option>All types</option><option>Hackathons</option><option>Coding contests</option></select></label>
              <label><span className="sr-only">Filter by participation format</span><select value={format} onChange={(event) => setFormat(event.target.value as FormatFilter)} className="h-10 w-full rounded-lg border border-[#e2d4b7] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#b78a3b] focus:ring-2 focus:ring-[#b78a3b]/20 dark:border-[#665332] dark:bg-[#17231f] dark:text-[#d4ded8]"><option>Any format</option><option>Team</option><option>Solo</option></select></label>
              {hasFilters && <button type="button" onClick={clearFilters} className="h-10 rounded-lg px-3 text-sm font-medium text-[#705323] hover:bg-white dark:text-[#f0d99e] dark:hover:bg-[#3a3020]">Clear</button>}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#b8aa83]">Search checks every word. Choose cards or a compact list below.</p>
          </section>
          <section aria-label="Annual event display controls" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfbe] bg-[#fffaf0] px-4 py-3 dark:border-[#665332] dark:bg-[#29271f]">
            <div role="group" aria-label="Annual event relevance" className="flex rounded-lg bg-[#f3e8c9] p-1 dark:bg-[#1b2621]">
              {(["branch", "all"] as const).map((value) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)} className={`min-h-9 rounded-md px-3 text-xs transition-colors ${scope === value ? "bg-white font-medium text-slate-900 shadow-sm dark:bg-[#514327] dark:text-[#f2ead0]" : "text-slate-600 hover:text-slate-900 dark:text-[#a9b9b0] dark:hover:text-[#e7eee9]"}`}>{value === "branch" ? `For ${profile.department}` : "All events"}</button>)}
            </div>
            <ViewToggle value={view} onChange={setView} />
          </section>
          <EventCatalog profile={profile} query={query} kind={kind} format={format} scope={scope} view={view} />
        </div>
      )}
    </ProfileGate>
  );
}

// ---------- Live feed: hackathons collected daily by the backend agent (analytics['hackathons']) ----------

type LiveChip = "india" | "online" | "contests";
const LIVE_CHIPS: { key: LiveChip; label: string }[] = [
  { key: "india", label: "In India" }, { key: "online", label: "Online" }, { key: "contests", label: "Coding contests" },
];
const LIVE_PAGE = 9;

function LiveCard({ event, department }: { event: LiveHackathon; department: string }) {
  const due = countdown(event);
  const place = event.mode === "Online" ? "Online" : [event.mode, event.location].filter(Boolean).join(" · ");
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-[#d8e3dc] bg-[#f4f8f5] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#b7d1c8] hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none dark:border-[#40584d] dark:bg-[#202c27] dark:hover:border-[#688576]">
      <span className={`absolute inset-x-0 top-0 h-1 ${due?.urgent ? "bg-[#d56f62] dark:bg-[#e58b7d]" : "bg-[#c49a4a] dark:bg-[#d4b36b]"}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#e2eee8] px-2.5 py-1 text-[11px] font-semibold text-[#18574e] dark:bg-[#30463b] dark:text-[#c9dfd2]">{event.source}</span>
        {event.kind === "Coding contest" && <span className="rounded-full bg-[#f5e9ca] px-2.5 py-1 text-[11px] font-semibold text-[#765820] dark:bg-[#514327] dark:text-[#f0d99e]">Coding contest</span>}
        {event.departments.includes(department) && event.departments.length < 4 && <span className="rounded-full bg-[#f5e9ca] px-2.5 py-1 text-[11px] font-medium text-[#765820] dark:bg-[#514327] dark:text-[#f0d99e]">For {department}</span>}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-[#172824] dark:text-[#e7eee9]">{event.title}</h3>
      {event.organiser && <p className="mt-1 text-xs text-slate-500 dark:text-[#b4c1b9]">{event.organiser}</p>}
      {event.summary && <p className="mt-3 text-sm leading-5 text-slate-600 dark:text-[#c1cdc5]">{event.summary}</p>}
      <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-[#bac7c0]">
        {place && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</p>}
        {event.team && <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{event.team === "1" ? "Solo" : `Team of ${event.team}`}</p>}
        {event.prize && <p className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />Prizes: {event.prize}</p>}
      </div>
      {due && <p className={`mt-3 w-fit rounded-md px-2 py-1 text-xs font-semibold ${due.urgent ? "bg-[#f9e5e1] text-[#9d3d32] dark:bg-[#512d29] dark:text-[#f1b0a5]" : "bg-[#f5e9ca] text-[#765820] dark:bg-[#514327] dark:text-[#f0d99e]"}`}>{due.text}</p>}
      <div className="min-h-4 flex-1" aria-hidden="true" />
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#e2eee8] px-3 text-sm font-semibold text-[#18574e] transition-colors hover:bg-[#d5e7dd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] dark:bg-[#30463b] dark:text-[#c9dfd2] dark:hover:bg-[#3a5447]">
        View &amp; register <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

type LiveState = { status: "loading" } | { status: "error" } | { status: "ready"; feed: HackathonFeed | null };

function LiveFeed({ profile, query, kind, format }: { profile: Profile; query: string; kind: KindFilter; format: FormatFilter }) {
  const [state, setState] = useState<LiveState>({ status: "loading" });
  const [scope, setScope] = useState<Scope>("branch");
  const [chip, setChip] = useState<LiveChip | null>(null);
  const [shown, setShown] = useState(LIVE_PAGE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadFeed()
      .then((feed) => !cancelled && setState({ status: "ready", feed }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => { cancelled = true; };
  }, [attempt]);

  const items = useMemo(() => {
    if (state.status !== "ready" || !state.feed) return [];
    return state.feed.items
      .filter((e) => scope === "all" || e.departments.includes(profile.department))
      .filter((e) => !chip || (chip === "india" && e.india) || (chip === "online" && e.mode === "Online") || (chip === "contests" && e.kind === "Coding contest"))
      .filter((e) => kind === "All types" || (kind === "Coding contests" ? e.kind === "Coding contest" : e.kind !== "Coding contest"))
      .filter((e) => matchesFormatFilter(format, e.team))
      .filter((e) => matchesEveryWord(query, [e.title, e.organiser, e.source, e.kind, e.mode, e.location, e.themes.join(" "), e.prize, e.departments.join(" "), e.summary].filter(Boolean).join(" ")));
  }, [state, scope, chip, profile.department, query, kind, format]);

  useEffect(() => { setShown(LIVE_PAGE); }, [scope, chip, query, kind, format]);

  if (state.status === "loading") {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dce7e1] bg-white px-4 py-4 text-sm text-slate-600">
        We couldn&apos;t load today&apos;s live list. The annual events below are always available.
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#286a62] underline underline-offset-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Try again
        </button>
      </div>
    );
  }
  const feed = state.feed;
  if (!feed || feed.items.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce7e1] bg-white px-4 py-4 text-sm text-slate-600">
        {query ? "No results found" : feed?.refreshing ? "We're collecting today's hackathons now. Check back in a minute." : "No open hackathons right now. The list refreshes every day."}
      </div>
    );
  }
  const sources = Object.entries(feed.sources).filter(([, s]) => s.ok && s.count > 0).map(([n]) => n);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Live event relevance" className="flex rounded-lg bg-[#edf2ef] p-1">
            {(["branch", "all"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
                className={`min-h-9 rounded-md px-3 text-xs transition-colors ${scope === value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                {value === "branch" ? `For ${profile.department}` : "All open"}
              </button>
            ))}
          </div>
          {LIVE_CHIPS.map((c) => (
            <button key={c.key} type="button" aria-pressed={chip === c.key} onClick={() => setChip(chip === c.key ? null : c.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors ${chip === c.key ? "bg-[#18574e] text-white ring-[#18574e]" : "bg-white text-slate-600 ring-[#dce7e1] hover:text-slate-900"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Updated {ago(feed.generated_at)} · {sources.join(", ")}{feed.refreshing ? " · updating now" : ""}</p>
      </div>
      <p aria-live="polite" className="text-sm text-slate-600"><span className="font-semibold text-[#172824]">{items.length}</span> open now · closing soonest first</p>
      {items.length ? (
        <>
          <StudentReveal key={`${scope}-${chip}`}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Open hackathons">
              {items.slice(0, shown).map((event) => <li key={event.id}><LiveCard event={event} department={profile.department} /></li>)}
            </ul>
          </StudentReveal>
          {items.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + LIVE_PAGE)}
              className="w-full rounded-lg border border-[#dce7e1] bg-white py-2.5 text-sm font-semibold text-[#286a62] hover:bg-[#edf5f1]">
              Show more ({items.length - shown} left)
            </button>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-[#dce7e1] bg-white px-5 py-8 text-center text-sm text-slate-500">
          {query ? "No results found" : "Nothing open in this filter right now. Try “All open” or another chip."}
        </div>
      )}
    </div>
  );
}

export function Hackathons() {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All types");
  const [format, setFormat] = useState<FormatFilter>("Any format");
  const hasFilters = Boolean(query || kind !== "All types" || format !== "Any format");
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(searchText.trim());
  };
  const clearSearchAndFilters = () => {
    setSearchText("");
    setQuery("");
    setKind("All types");
    setFormat("Any format");
  };

  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-6">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-[#172824] dark:text-[#e7eee9]">Hackathons</h2>
          <YourRecord profile={profile} />
          <section aria-label="Search hackathons" className="rounded-xl border border-[#dce7e1] bg-[#f1f6f3] p-3 sm:p-4 dark:border-[#354b41] dark:bg-[#202c27]">
            <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search all hackathons and contests</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search events, organisers, or skills"
                  className="h-11 w-full rounded-lg border border-[#dce7e1] bg-white pl-9 pr-3 text-sm text-[#172824] outline-none transition placeholder:text-slate-400 focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15 dark:border-[#40584d] dark:bg-[#17231f] dark:text-[#e7eee9] dark:placeholder:text-[#84968b]" />
              </label>
              <button type="submit" className="h-11 rounded-lg bg-[#18574e] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#12473f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 dark:bg-[#467567] dark:hover:bg-[#568a7a]">Search</button>
            </form>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="sr-only">Filter by event type</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15 dark:border-[#40584d] dark:bg-[#17231f] dark:text-[#d4ded8]">
                  <option>All types</option><option>Hackathons</option><option>Coding contests</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by participation format</span>
                <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 w-full rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15 dark:border-[#40584d] dark:bg-[#17231f] dark:text-[#d4ded8]">
                  <option>Any format</option><option>Team</option><option>Solo</option>
                </select>
              </label>
              {hasFilters && <button type="button" onClick={clearSearchAndFilters} className="h-10 rounded-lg px-3 text-sm font-medium text-[#286a62] hover:bg-white dark:text-[#c9dfd2] dark:hover:bg-[#27352e]">Clear</button>}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#a9b9b0]">Search checks every word across live and annual events.</p>
          </section>
          <section aria-labelledby="live-heading" className="space-y-3">
            <div>
              <h2 id="live-heading" className="text-base font-semibold text-[#172824] dark:text-[#e7eee9]">Open now <span className="ml-1 rounded-full bg-[#f9e5e1] px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-[#9d3d32] dark:bg-[#512d29] dark:text-[#f1b0a5]">Live</span></h2>
              <p className="text-sm text-slate-500 dark:text-[#a9b9b0]">Hackathons and contests you can still register for, collected daily from Unstop, Devpost, HackerEarth, MLH and CodeChef.</p>
            </div>
            <LiveFeed profile={profile} query={query} kind={kind} format={format} />
          </section>
        </div>
      )}
    </ProfileGate>
  );
}
