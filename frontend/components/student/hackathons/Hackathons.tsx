"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ExternalLink, LayoutGrid, List as ListIcon, MapPin, RefreshCw, Search, Trophy, Users, X } from "lucide-react";
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
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-[#dce7e1] bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#b7d1c8] hover:shadow-md hover:shadow-slate-900/[0.06] motion-reduce:transform-none motion-reduce:transition-none">
      <span className={`absolute inset-x-0 top-0 h-1 ${due?.urgent ? "bg-red-400" : "bg-[#398b7d]"}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{event.source}</span>
        {event.kind === "Coding contest" && <span className="rounded-full bg-[#eaf3ef] px-2.5 py-1 text-[11px] font-semibold text-[#18574e]">Coding contest</span>}
        {event.departments.includes(department) && event.departments.length < 4 && <span className="rounded-full bg-[#eff8f5] px-2.5 py-1 text-[11px] font-medium text-[#286a62]">For {department}</span>}
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-[#172824]">{event.title}</h3>
      {event.organiser && <p className="mt-1 text-xs text-slate-500">{event.organiser}</p>}
      {event.summary && <p className="mt-3 text-sm leading-5 text-slate-600">{event.summary}</p>}
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        {place && <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{place}</p>}
        {event.team && <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{event.team === "1" ? "Solo" : `Team of ${event.team}`}</p>}
        {event.prize && <p className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" aria-hidden="true" />Prizes: {event.prize}</p>}
      </div>
      {due && <p className={`mt-3 text-xs font-semibold ${due.urgent ? "text-red-700" : "text-[#18574e]"}`}>{due.text}</p>}
      <div className="min-h-4 flex-1" aria-hidden="true" />
      <a href={event.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#eaf3ef] px-3 text-sm font-semibold text-[#18574e] transition-colors hover:bg-[#dcece4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
        View &amp; register <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

type LiveState = { status: "loading" } | { status: "error" } | { status: "ready"; feed: HackathonFeed | null };

function LiveFeed({ profile }: { profile: Profile }) {
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
      .filter((e) => !chip || (chip === "india" && e.india) || (chip === "online" && e.mode === "Online") || (chip === "contests" && e.kind === "Coding contest"));
  }, [state, scope, chip, profile.department]);

  useEffect(() => { setShown(LIVE_PAGE); }, [scope, chip]);

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
        {feed?.refreshing ? "We're collecting today's hackathons now. Check back in a minute." : "No open hackathons right now. The list refreshes every day."}
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
          Nothing open in this filter right now. Try &ldquo;All open&rdquo; or another chip.
        </div>
      )}
    </div>
  );
}

export function Hackathons() {
  return (
    <ProfileGate>
      {(profile) => (
        <div className="space-y-6">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-[#172824]">Hackathons</h2>
          <YourRecord profile={profile} />
          <section aria-labelledby="live-heading" className="space-y-3">
            <div>
              <h2 id="live-heading" className="text-base font-semibold text-[#172824]">Open now <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-red-700">Live</span></h2>
              <p className="text-sm text-slate-500">Hackathons and contests you can still register for, collected daily from Unstop, Devpost, HackerEarth, MLH and CodeChef.</p>
            </div>
            <LiveFeed profile={profile} />
          </section>
          <section aria-labelledby="annual-heading" className="space-y-3">
            <div>
              <h2 id="annual-heading" className="text-base font-semibold text-[#172824]">Annual events and platforms</h2>
              <p className="text-sm text-slate-500">Recurring national and global events worth planning for.</p>
            </div>
            <EventCatalog profile={profile} />
          </section>
        </div>
      )}
    </ProfileGate>
  );
}
