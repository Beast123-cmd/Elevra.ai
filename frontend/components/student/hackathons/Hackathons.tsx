"use client";

import { useState } from "react";
import { ExternalLink, Trophy } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const flagged = p.placement_risk.drivers.some((d) => /hackathon/i.test(d.label));
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-50 p-2.5 text-teal-800"><Trophy className="h-5 w-5" aria-hidden="true" /></div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{count}</p>
            <p className="text-sm text-slate-500">verified hackathon{count === 1 ? "" : "s"} on your record</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 sm:ml-6 sm:border-l sm:pl-6">
          {flagged
            ? "Your placement outlook lists “no verified hackathons or certifications”. Taking part in one removes that flag and adds to your co-curricular score."
            : count === 0
              ? "Hackathons add to your co-curricular score and show recruiters you can build under pressure."
              : "Nice. Each verified hackathon adds to your co-curricular score. Another one in your branch's focus area makes your profile stronger."}
        </p>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter hackathons" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === f.key ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Dates change every year, so check each official site for the current edition.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing in this filter yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((h) => (
            <Card key={h.name} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{h.kind}</Badge>
                  <Badge variant="outline">{h.format}</Badge>
                  {suits(h, p.department) && h.departments.length > 0 && <Badge>Fits {p.department}</Badge>}
                </div>
                <CardTitle className="text-base leading-snug">{h.name}</CardTitle>
                <p className="text-xs text-slate-500">{h.organiser}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-sm text-slate-700">{h.about}</p>
                <p className="text-xs text-slate-500">{h.focus.join(" · ")}</p>
                <a href={h.url} target="_blank" rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-teal-800 underline underline-offset-2">
                  Visit official site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-slate-50">
        <CardContent className="p-5 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Make it count:</span> after the event, share your participation or
          winner certificate with your faculty mentor so it&apos;s verified and added to your record.
        </CardContent>
      </Card>
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
