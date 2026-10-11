import { createClient } from "@/lib/supabase/client";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("elevra:unauthorized"));
  if (!r.ok) {
    // FastAPI puts the human-readable reason in `detail`; keep it so screens can show why a request failed.
    const detail = await r.json().then((j) => (typeof j?.detail === "string" ? j.detail : "")).catch(() => "");
    throw new Error(`API ${path} failed: ${r.status}${detail ? ` - ${detail}` : ""}`);
  }
  return r.json();
}
