"use client";

import { useState } from "react";
import { ExternalLink, Trophy } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileGate } from "../ProfileGate";
import { HACKATHONS, type Hackathon } from "./data";

type Filter = "for-you" | "all" | "contests";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "for-you", label: "For your branch" },
  { key: "all", label: "All" },
  { key: "contests", label: "Coding contests" },
];

const suits = (h: Hackathon, dept: string) => h.departments.length === 0 || h.departments.includes(dept);

function YourRecord({ p }: { p: Profile }) {
  const count = Number(p.metrics.hackathons ?? 0);
  return (
    <Card className="rounded-xl border-[#dce7e1] bg-[#f4f7f5] shadow-none">
      <CardContent className="flex items-center gap-3 px-4 py-3">
        <Trophy className="h-4 w-4 shrink-0 text-[#286a62]" aria-hidden="true" />
        <p className="text-sm text-slate-700"><span className="font-semibold tabular-nums text-[#172824]">{count}</span> verified hackathon{count === 1 ? "" : "s"} on your record</p>
      </CardContent>
    </Card>
  );
}

function List({ p }: { p: Profile }) {
  const [filter, setFilter] = useState<Filter>("for-you");
  const items = HACKATHONS
    .filter((h) => (filter === "all" ? true : filter === "contests" ? h.kind === "Coding contest" : suits(h, p.department)))
    .sort((a, b) => Number(suits(b, p.department)) - Number(suits(a, p.department)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Filter hackathons" className="flex flex-wrap gap-1 rounded-lg bg-[#edf2ef] p-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`min-h-9 rounded-md px-3 py-1.5 text-xs transition-colors ${filter === f.key ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-[#dce7e1] bg-white px-4 py-5 text-sm text-slate-500">No events match this filter.</p>
      ) : (
        <ul className="divide-y divide-[#e7eeea] rounded-xl border border-[#dce7e1] bg-white px-4 sm:px-5">
          {items.map((h) => (
            <li key={h.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-5 text-[#172824]">{h.name}</p>
                <p className="mt-1 text-xs text-slate-500">{h.organiser} · {h.kind} · {h.format}</p>
                <p className="mt-1 text-xs text-slate-500">{h.focus.join(" · ")}</p>
              </div>
              <a href={h.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-[#1d6158] no-underline hover:bg-[#eef5f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
                Official site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-5 text-slate-500">Check official sites for current dates. Share proof of participation with your faculty mentor to add it to your record.</p>
    </div>
  );
}

export function Hackathons() {
  return (
    <ProfileGate>
      {(p) => (
        <div className="space-y-6">
          <YourRecord p={p} />
          <List p={p} />
        </div>
      )}
    </ProfileGate>
  );
}
