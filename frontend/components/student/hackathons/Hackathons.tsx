"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, MapPin, RefreshCw, Trophy, Users } from "lucide-react";
import type { Profile } from "@/lib/types";
import { SearchFilterBar } from "@/components/shared/SearchFilterBar";
import { Pagination } from "@/components/shared/Pagination";
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
  National: "border-risk-amber/30 bg-risk-amber-bg",
  Global: "border-border bg-muted",
  Platform: "border-risk-amber/30 bg-risk-amber-bg",
  "Coding contest": "border-border bg-muted",
};

const suits = (h: Hackathon, dept: string) => h.departments.length === 0 || h.departments.includes(dept);

function EventCard({ event, compact = false }: { event: Hackathon; compact?: boolean }) {
  return (
    <article className={`group rounded-xl border transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none ${EVENT_SURFACE[event.kind]} ${compact ? "flex items-center gap-4 p-4" : "flex h-full flex-col p-4"}`}>
      <div className="min-w-0 flex-1">
        <span className="mb-2 inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-primary">{event.organiser}</span>
        <h3 className="font-semibold leading-snug text-foreground">{event.name}</h3>
        <p className={`mt-2 text-sm leading-5 text-muted-foreground ${compact ? "line-clamp-1" : "line-clamp-2"}`}>{event.about}</p>
      </div>
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        aria-label={`Explore ${event.name}`}
        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-risk-amber-bg px-3 text-sm font-semibold text-risk-amber transition-colors hover:bg-risk-amber-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-risk-amber ${compact ? "shrink-0" : "mt-5 w-fit"}`}>
        Explore <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="Event display" className="flex rounded-lg border border-border bg-card p-1">
      <button type="button" onClick={() => onChange("grid")} aria-pressed={value === "grid"} aria-label="Show events as cards"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "grid" ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted/60"}`}>
        <LayoutGrid className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Cards</span>
      </button>
      <button type="button" onClick={() => onChange("list")} aria-pressed={value === "list"} aria-label="Show events as a list"
        className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${value === "list" ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted/60"}`}>
        <ListIcon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}

function EventCatalog({ profile, query, kind, format, scope, view, animate }: { profile: Profile; query: string; kind: KindFilter; format: FormatFilter; scope: Scope; view: ViewMode; animate: boolean }) {
  const events = HACKATHONS
    .filter((event) => scope === "all" || suits(event, profile.department))
    .filter((event) => kind === "All types" || (kind === "Coding contests" ? event.kind === "Coding contest" : event.kind !== "Coding contest"))
    .filter((event) => matchesFormatFilter(format, event.format))
    .filter((event) => matchesEveryWord(query, `${event.name} ${event.organiser} ${event.kind} ${event.format} ${event.focus.join(" ")} ${event.about}`))
    .sort((a, b) => Number(suits(b, profile.department)) - Number(suits(a, profile.department)) || a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      <p aria-live="polite" className="-mb-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{events.length}</span> events for {profile.department}</p>
      {events.length ? (
        <ul className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"} aria-label="Hackathon results">
          {events.map((event, index) => (
            <li key={event.name}>
              <StudentReveal animate={animate} delayMs={Math.min(index, 3) * 90} className="h-full">
                <EventCard event={event} compact={view === "list"} />
              </StudentReveal>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center">
          <p className="font-medium text-foreground">No results found</p>
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">Check official sites for current dates. Share proof of participation with your faculty mentor to add it to your record.</p>
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
  const [resultsRefined, setResultsRefined] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const clearFilters = () => {
    setResultsRefined(true);
    setSearchText("");
    setQuery("");
    setKind("All types");
    setFormat("Any format");
    setScope("branch");
  };
  const activeFilterCount = Number(kind !== "All types") + Number(format !== "Any format") + Number(scope !== "branch");

  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-5">
          <SearchFilterBar
            label="Search annual events and platforms"
            placeholder="Search events, organisers, or skills"
            value={searchText}
            onChange={(value) => { setResultsRefined(true); setSearchText(value); }}
            onSearch={() => { setResultsRefined(true); setQuery(searchText.trim()); }}
            activeFilters={activeFilterCount}
            onClear={clearFilters}
            filters={<>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Event type
                <select value={kind} onChange={(event) => { setResultsRefined(true); setKind(event.target.value as KindFilter); }} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"><option>All types</option><option>Hackathons</option><option>Coding contests</option></select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Format
                <select value={format} onChange={(event) => { setResultsRefined(true); setFormat(event.target.value as FormatFilter); }} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"><option>Any format</option><option>Team</option><option>Solo</option></select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Events
                <select value={scope} onChange={(event) => { setResultsRefined(true); setScope(event.target.value as Scope); }} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"><option value="branch">For {profile.department}</option><option value="all">All events</option></select>
              </label>
            </>}
          />
          <section aria-label="Annual event display controls" className="flex flex-wrap items-center justify-end gap-3">
            <ViewToggle value={view} onChange={(nextView) => { setResultsRefined(true); setView(nextView); }} />
          </section>
          <EventCatalog profile={profile} query={query} kind={kind} format={format} scope={scope} view={view} animate={!resultsRefined} />
        </div>
      )}
    </ProfileGate>
  );
}

// ---------- Live feed: hackathons collected daily by the backend agent (analytics['hackathons']) ----------

type LiveLocation = "Any location" | "In India" | "Online";
const LIVE_PAGE = 27;

function LiveCard({ event }: { event: LiveHackathon }) {
  const due = countdown(event);
  const place = event.mode === "Online" ? "Online" : [event.mode, event.location].filter(Boolean).join(" · ");
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-muted p-3 transition duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none">
      <span className={`absolute inset-x-0 top-0 h-1 ${due?.urgent ? "bg-risk-red-bg" : "bg-risk-amber-bg"}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-primary">{event.source}</span>
        {event.kind === "Coding contest" && <span className="rounded-full bg-risk-amber-bg px-2 py-0.5 text-[11px] font-semibold text-risk-amber">Coding contest</span>}
      </div>
      <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">{event.title}</h3>
      {event.organiser && event.organiser.toLowerCase() !== event.source.toLowerCase() && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{event.organiser}</p>}
      {event.summary && <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{event.summary}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{place}</span>}
        {event.team && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{event.team === "1" ? "Solo" : `Team ${event.team}`}</span>}
        {event.prize && <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{event.prize}</span>}
      </div>
      {due && <p className={`mt-2 text-xs font-semibold ${due.urgent ? "text-risk-red" : "text-risk-amber"}`}>{due.text}</p>}
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className="mt-auto inline-flex min-h-9 w-full items-center justify-center gap-2 pt-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        View &amp; register <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

type LiveState = { status: "loading" } | { status: "error" } | { status: "ready"; feed: HackathonFeed | null };

function LiveFeed({ profile, query, kind, format, scope, location }: { profile: Profile; query: string; kind: KindFilter; format: FormatFilter; scope: Scope; location: LiveLocation }) {
  const [state, setState] = useState<LiveState>({ status: "loading" });
  const [shown, setShown] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);
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
      .filter((e) => location === "Any location" || (location === "In India" ? e.india : e.mode === "Online"))
      .filter((e) => kind === "All types" || (kind === "Coding contests" ? e.kind === "Coding contest" : e.kind !== "Coding contest"))
      .filter((e) => matchesFormatFilter(format, e.team))
      .filter((e) => matchesEveryWord(query, [e.title, e.organiser, e.source, e.kind, e.mode, e.location, e.themes.join(" "), e.prize, e.departments.join(" "), e.summary].filter(Boolean).join(" ")));
  }, [state, scope, location, profile.department, query, kind, format]);

  useEffect(() => { setShown(1); }, [scope, location, query, kind, format]);

  if (state.status === "loading") {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        We couldn&apos;t load today&apos;s live list. The annual events below are always available.
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />Try again
        </button>
      </div>
    );
  }
  const feed = state.feed;
  if (!feed || feed.items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
        {query ? "No results found" : feed?.refreshing ? "We're collecting today's hackathons now. Check back in a minute." : "No open hackathons right now. The list refreshes every day."}
      </div>
    );
  }
  const sources = Object.entries(feed.sources).filter(([, s]) => s.ok && s.count > 0).map(([n]) => n);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <p className="text-xs text-muted-foreground">Updated {ago(feed.generated_at)} · {sources.join(", ")}{feed.refreshing ? " · updating now" : ""}</p>
      </div>
      <div ref={resultsRef} className="scroll-mt-6">
      <p aria-live="polite" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{items.length}</span> open now · closing soonest first</p>
      {items.length ? (
        <>
          <StudentReveal>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Open hackathons">
              {items.slice((shown - 1) * LIVE_PAGE, shown * LIVE_PAGE).map((event) => <li key={event.id}><LiveCard event={event} /></li>)}
            </ul>
          </StudentReveal>
          <Pagination page={shown} totalItems={items.length} pageSize={LIVE_PAGE} label="Hackathon pages" onPageChange={(page) => {
            setShown(page);
            requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {query ? "No results found" : "Nothing open for these filters right now."}
        </div>
      )}
      </div>
    </div>
  );
}

export function Hackathons() {
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All types");
  const [format, setFormat] = useState<FormatFilter>("Any format");
  const [scope, setScope] = useState<Scope>("branch");
  const [location, setLocation] = useState<LiveLocation>("Any location");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchText.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const clearSearchAndFilters = () => {
    setSearchText("");
    setQuery("");
    setKind("All types");
    setFormat("Any format");
    setScope("branch");
    setLocation("Any location");
  };
  const activeFilterCount = Number(kind !== "All types") + Number(format !== "Any format") + Number(scope !== "branch") + Number(location !== "Any location");

  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-6">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-foreground">Hackathons</h2>
          <SearchFilterBar
            label="Search hackathons"
            placeholder="Search events, organisers, or skills"
            value={searchText}
            onChange={setSearchText}
            onSearch={() => setQuery(searchText.trim())}
            activeFilters={activeFilterCount}
            onClear={clearSearchAndFilters}
            filters={<>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Event type
                <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option>All types</option><option>Hackathons</option><option>Coding contests</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Format
                <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option>Any format</option><option>Team</option><option>Solo</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Events
                <select value={scope} onChange={(event) => setScope(event.target.value as Scope)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option value="branch">For {profile.department}</option><option value="all">All open</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">Location
                <select value={location} onChange={(event) => setLocation(event.target.value as LiveLocation)} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option>Any location</option><option>In India</option><option>Online</option>
                </select>
              </label>
            </>}
          />
          <section aria-labelledby="live-heading" className="space-y-3">
            <div>
              <h2 id="live-heading" className="text-base font-semibold text-foreground">Open now <span className="ml-1 rounded-full bg-risk-red-bg px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-risk-red">Live</span></h2>
            </div>
            <LiveFeed profile={profile} query={query} kind={kind} format={format} scope={scope} location={location} />
          </section>
        </div>
      )}
    </ProfileGate>
  );
}
