"use client";
import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { localMessage, mailtoUrl, MESSAGE_KINDS, whatsappUrl, type MessageKind } from "./messageTemplate";

type Draft = { text: string; source: "ai" | "template" | "local"; note?: string };

/** Drafts a message the mentor reviews, edits and sends themselves. Nothing is sent from here. */
export function MessageDrafts({ profile }: { profile: Profile }) {
  const [kind, setKind] = useState<MessageKind>("student_checkin");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  // a different student must never show the previous student's message
  useEffect(() => setDraft(null), [profile.student_id]);

  async function write(k: MessageKind) {
    setKind(k);
    setBusy(true);
    try {
      const r = await api<{ message: string; source: "ai" | "template"; reason?: string }>(`/briefs/${profile.student_id}/message`, { kind: k });
      setDraft({ text: r.message, source: r.source, note: r.reason });
    } catch {
      setDraft({ text: localMessage(k, profile), source: "local", note: "The message service is offline, so this draft was built in your browser." });
    } finally {
      setBusy(false);
    }
  }

  const subject = kind === "guardian_attendance" ? `About ${profile.name}'s attendance` : "A quick check-in";
  const label = draft?.source === "ai" ? "AI-written · checked against the profile" : "Standard draft";

  return (
    <Card className="space-y-3 p-4" aria-label="Message drafts">
      <div>
        <h2 className="text-sm font-semibold">Write to this student</h2>
        <p className="text-xs text-muted-foreground">Pick a message, edit it, and send it yourself. Nothing is sent from here.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Message type">
        {MESSAGE_KINDS.map(([k, name]) => (
          <Button key={k} size="sm" variant={draft && kind === k ? "default" : "outline"} disabled={busy} onClick={() => write(k)}>
            {busy && kind === k ? "Writing…" : name}
          </Button>
        ))}
      </div>
      {draft && (
        <div className="space-y-2">
          <textarea aria-label="Message text" className="min-h-32 w-full rounded-md border border-input bg-card p-3 text-[15px] leading-relaxed" value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded px-1.5 py-0.5 font-medium ${draft.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted"}`}>{label}</span>
            {draft.note && <span>{draft.note}</span>}
          </div>
          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
            <span className="text-sm font-medium sm:mr-auto">Send it yourself</span>
            <Button className="h-10 gap-2" onClick={() => navigator.clipboard.writeText(draft.text).then(() => toast.success("Message copied"), () => toast.error("Could not copy"))}>
              <Copy className="h-4 w-4" aria-hidden="true" />Copy message
            </Button>
            <Button asChild variant="outline" className="h-10 gap-2">
              <a href={whatsappUrl(draft.text)} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true" />Open in WhatsApp</a>
            </Button>
            <Button asChild variant="outline" className="h-10 gap-2">
              <a href={mailtoUrl(subject, draft.text)}><Mail className="h-4 w-4" aria-hidden="true" />Open in email</a>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
