import { createClient } from "@/lib/supabase/client";

/** DELETE a saved assistant conversation. (lib/api.ts only does GET and POST, and lib/ is shared, so this lives here.) */
export async function deleteConversation(id: number): Promise<void> {
  const { data } = await createClient().auth.getSession();
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/assistant/conversations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  if (!r.ok) throw new Error(`delete failed: ${r.status}`);
}

export interface Conversation { id: number; title: string; updated_at: string }

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
