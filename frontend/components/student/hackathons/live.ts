import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

/** One item of the daily hackathon feed written by the backend (analytics['hackathons']). */
export interface LiveHackathon {
  id: string; source: string; title: string; url: string; organiser: string | null;
  kind: "Hackathon" | "Coding contest"; mode: "Online" | "In person" | "Hybrid" | null; location: string | null;
  starts_at: string | null; ends_at: string | null; deadline: string | null; team: string | null;
  themes: string[]; prize: string | null; india: boolean; departments: string[]; summary: string;
}

export interface HackathonFeed {
  generated_at: string | null;
  items: LiveHackathon[];
  sources: Record<string, { ok: boolean; count: number; error?: string }>;
  refreshing?: boolean;
}

/** The backend first (it also triggers the daily refresh); if it is down, read the stored feed straight from Supabase. */
export async function loadFeed(): Promise<HackathonFeed | null> {
  try {
    return await api<HackathonFeed>("/hackathons");
  } catch {
    const { data, error } = await createClient().from("analytics").select("payload").eq("key", "hackathons").maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.payload as HackathonFeed | undefined) ?? null;
  }
}

const DAY = 86_400_000;

/** "Closes today", "Closes in 3 days", "Starts in 5 days" … based on the soonest relevant date. */
export function countdown(h: LiveHackathon, now = Date.now()): { text: string; urgent: boolean } | null {
  const target = h.deadline ?? h.ends_at;
  if (!target) return null;
  const days = Math.ceil((new Date(target).getTime() - now) / DAY);
  const verb = h.kind === "Coding contest" ? "Ends" : "Registration closes";
  if (days <= 0) return { text: `${verb} today`, urgent: true };
  if (days === 1) return { text: `${verb} tomorrow`, urgent: true };
  return { text: `${verb} in ${days} days`, urgent: days <= 2 };
}

export function ago(iso: string | null, now = Date.now()): string {
  if (!iso) return "not yet";
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}
