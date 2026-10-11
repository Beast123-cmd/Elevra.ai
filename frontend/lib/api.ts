import { createClient } from "@/lib/supabase/client";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${path} failed: ${r.status}`);
  return r.json();
}
