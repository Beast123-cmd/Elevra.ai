"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { studentFilter } from "./search";

interface Hit { student_id: string; name: string; department: string; year: number }

/** "Find a student" for staff. Row-level security limits a mentor to their own students. */
export function StudentSearch() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filter = studentFilter(q);
    if (!filter) {
      setHits([]);
      setState("idle");
      return;
    }
    setState("loading");
    const t = window.setTimeout(async () => {
      const { data, error } = await createClient().from("students").select("student_id,name,department,year").or(filter).order("name").limit(8);
      if (error) {
        setState("error");
        return;
      }
      setHits((data ?? []) as Hit[]);
      setActive(0);
      setState("idle");
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    router.push(`/faculty/student/${hit.student_id}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (!hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
    if (e.key === "Enter") { e.preventDefault(); go(hits[active]); }
  }

  const showList = open && studentFilter(q) !== null;

  return (
    <div ref={box} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Find a student by name or ID"
        placeholder="Find a student"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground"
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover py-1 text-sm shadow-lg">
          {state === "loading" && hits.length === 0 && <li className="px-3 py-2 text-muted-foreground">Searching…</li>}
          {state === "error" && <li className="px-3 py-2 text-muted-foreground">Search is unavailable right now.</li>}
          {state === "idle" && hits.length === 0 && <li className="px-3 py-2 text-muted-foreground">No student matches “{q.trim()}”.</li>}
          {hits.map((h, i) => (
            <li
              key={h.student_id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(h); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${i === active ? "bg-muted" : ""}`}
            >
              <span className="truncate font-medium">{h.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{h.student_id} · {h.department} · Y{h.year}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
