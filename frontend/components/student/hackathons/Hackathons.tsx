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
  National: "border-risk-amber/30 bg-risk-amber-bg",
  Global: "border-border bg-muted",
  Platform: "border-risk-amber/30 bg-risk-amber-bg",
  "Coding contest": "border-border bg-muted",
};

const suits = (h: Hackathon, dept: string) => h.departments.length === 0 || h.departments.includes(dept);

function YourRecord({ profile }: { profile: Profile }) {
  const count = Number(profile.metrics.hackathons ?? 0);
  return (
    <Card className="rounded-xl border-risk-amber/30 bg-risk-amber-bg shadow-none">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-risk-amber-bg text-risk-amber"><Trophy className="h-4 w-4" aria-hidden="true" /></span>
        <p className="text-sm text-foreground"><span className="font-semibold tabular-nums text-foreground">{count}</span> verified hackathon{count === 1 ? "" : "s"} on your record</p>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">Share participation proof with your mentor to add it</span>
      </CardContent>
    </Card>
  );
}

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

function EventCatalog({ profile, query, kind, format, scope, view }: { profile: Profile; query: string; kind: KindFilter; format: FormatFilter; scope: Scope; view: ViewMode }) {
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
              <StudentReveal key={`${query}-${scope}-${kind}-${format}-${view}-${event.name}`} delayMs={Math.min(index, 8) * 45} className="h-full">
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
          <section aria-label="Search annual events" className="rounded-xl border border-risk-amber/30 bg-risk-amber-bg p-3 sm:p-4">
            <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search annual events and platforms</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-risk-amber" aria-hidden="true" />
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search events, organisers, or skills"
                  className="h-11 w-full rounded-lg border border-risk-amber/30 bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-risk-amber focus:ring-2 focus:ring-risk-amber/25" />
              </label>
              <button type="submit" className="h-11 rounded-lg bg-risk-amber-bg px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-risk-amber-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-risk-amber focus-visible:ring-offset-2">Search</button>
            </form>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label><span className="sr-only">Filter by event type</span><select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-risk-amber/30 bg-card px-3 text-sm text-foreground outline-none focus:border-risk-amber focus:ring-2 focus:ring-risk-amber/25"><option>All types</option><option>Hackathons</option><option>Coding contests</option></select></label>
              <label><span className="sr-only">Filter by participation format</span><select value={format} onChange={(event) => setFormat(event.target.value as FormatFilter)} className="h-10 w-full rounded-lg border border-risk-amber/30 bg-card px-3 text-sm text-foreground outline-none focus:border-risk-amber focus:ring-2 focus:ring-risk-amber/25"><option>Any format</option><option>Team</option><option>Solo</option></select></label>
              {hasFilters && <button type="button" onClick={clearFilters} className="h-10 rounded-lg px-3 text-sm font-medium text-risk-amber hover:bg-card">Clear</button>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Search checks every word. Choose cards or a compact list below.</p>
          </section>
          <section aria-label="Annual event display controls" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-risk-amber/30 bg-risk-amber-bg px-4 py-3">
            <div role="group" aria-label="Annual event relevance" className="flex rounded-lg bg-risk-amber-bg p-1">
              {(["branch", "all"] as const).map((value) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)} className={`min-h-9 rounded-md px-3 text-xs transition-colors ${scope === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{value === "branch" ? `For ${profile.department}` : "All events"}</button>)}
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
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-muted p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none">
      <span className={`absolute inset-x-0 top-0 h-1 ${due?.urgent ? "bg-risk-red-bg" : "bg-risk-amber-bg"}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary">{event.source}</span>
        {event.kind === "Coding contest" && <span className="rounded-full bg-risk-amber-bg px-2.5 py-1 text-[11px] font-semibold text-risk-amber">Coding contest</span>}
        {event.departments.includes(department) && event.departments.length < 4 && <span className="rounded-full bg-risk-amber-bg px-2.5 py-1 text-[11px] font-medium text-risk-amber">For {department}</span>}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">{event.title}</h3>
      {event.organiser && <p className="mt-1 text-xs text-muted-foreground">{event.organiser}</p>}
      {event.summary && <p className="mt-3 text-sm leading-5 text-muted-foreground">{event.summary}</p>}
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {place && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</p>}
        {event.team && <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{event.team === "1" ? "Solo" : `Team of ${event.team}`}</p>}
        {event.prize && <p className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />Prizes: {event.prize}</p>}
      </div>
      {due && <p className={`mt-3 w-fit rounded-md px-2 py-1 text-xs font-semibold ${due.urgent ? "bg-risk-red-bg text-risk-red" : "bg-risk-amber-bg text-risk-amber"}`}>{due.text}</p>}
      <div className="min-h-4 flex-1" aria-hidden="true" />
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Live event relevance" className="flex rounded-lg bg-muted p-1">
            {(["branch", "all"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
                className={`min-h-9 rounded-md px-3 text-xs transition-colors ${scope === value ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {value === "branch" ? `For ${profile.department}` : "All open"}
              </button>
            ))}
          </div>
          {LIVE_CHIPS.map((c) => (
            <button key={c.key} type="button" aria-pressed={chip === c.key} onClick={() => setChip(chip === c.key ? null : c.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-colors ${chip === c.key ? "bg-primary text-primary-foreground ring-ring" : "bg-card text-muted-foreground ring-border hover:text-foreground"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Updated {ago(feed.generated_at)} · {sources.join(", ")}{feed.refreshing ? " · updating now" : ""}</p>
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{items.length}</span> open now · closing soonest first</p>
      {items.length ? (
        <>
          <StudentReveal key={`${scope}-${chip}`}>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Open hackathons">
              {items.slice(0, shown).map((event) => <li key={event.id}><LiveCard event={event} department={profile.department} /></li>)}
            </ul>
          </StudentReveal>
          {items.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + LIVE_PAGE)}
              className="w-full rounded-lg border border-border bg-card py-2.5 text-sm font-semibold text-primary hover:bg-muted">
              Show more ({items.length - shown} left)
            </button>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
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
          <h2 className="text-lg font-bold leading-tight tracking-tight text-foreground">Hackathons</h2>
          <YourRecord profile={profile} />
          <section aria-label="Search hackathons" className="rounded-xl border border-border bg-muted/60 p-3 sm:p-4">
            <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search all hackathons and contests</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search events, organisers, or skills"
                  className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20" />
              </label>
              <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Search</button>
            </form>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="sr-only">Filter by event type</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option>All types</option><option>Hackathons</option><option>Coding contests</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by participation format</span>
                <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20">
                  <option>Any format</option><option>Team</option><option>Solo</option>
                </select>
              </label>
              {hasFilters && <button type="button" onClick={clearSearchAndFilters} className="h-10 rounded-lg px-3 text-sm font-medium text-primary hover:bg-card">Clear</button>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Search checks every word across live and annual events.</p>
          </section>
          <section aria-labelledby="live-heading" className="space-y-3">
            <div>
              <h2 id="live-heading" className="text-base font-semibold text-foreground">Open now <span className="ml-1 rounded-full bg-risk-red-bg px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-risk-red">Live</span></h2>
              <p className="text-sm text-muted-foreground">Hackathons and contests you can still register for, collected daily from Unstop, Devpost, HackerEarth, MLH and CodeChef.</p>
            </div>
            <LiveFeed profile={profile} query={query} kind={kind} format={format} />
          </section>
        </div>
      )}
    </ProfileGate>
  );
}
