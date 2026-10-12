"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Lightbulb } from "lucide-react";
import { api } from "@/lib/api";
import { AssistantShell } from "@/components/shared/assistant/AssistantShell";
import { ChatChart, type ChartSpec } from "./ChatChart";
import { deleteConversation as removeConversation, type Conversation } from "./conversations";

type Cell = string | number | boolean | null;
interface Answer {
  question: string; asked: string; answer: string; sql: string | null; columns: string[]; rows: Cell[][];
  row_count: number; truncated: boolean; source: "ai" | "template" | "none";
  chart: ChartSpec | null; summary: string; actions: string[]; follow_ups: string[]; conversation_id?: number | null;
  links?: { label: string; href: string }[] | null; mode?: "data" | "navigate" | "help" | "chat";
}
interface Turn { question: string; answer?: Answer; error?: string }
interface SavedMessage { role: "user" | "assistant"; content: string; payload: Partial<Answer> }

const FALLBACK_SUGGESTIONS = {
  faculty: ["Which of my mentees need attention first?", "How many of my mentees are below 75% attendance?", "Open the attendance planner"],
  admin: ["Show academic risk by department", "Who are the 10 highest-priority students?", "Which students are below 65% attendance?"],
};
const pretty = (s: string) => s.replace(/_/g, " ");
const cell = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

function ResultTable({ a, onNavigate }: { a: Answer; onNavigate: () => void }) {
  if (a.rows.length === 0) return null;
  const idCol = a.columns.indexOf("student_id"); // when present, each student's id and name open their full record
  return (
    <details className="rounded-lg border border-border bg-card" open={!a.chart}>
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">
        Results table · {a.row_count} row{a.row_count === 1 ? "" : "s"}{a.truncated ? " (first 200 shown)" : ""}
      </summary>
      <div className="max-h-64 overflow-auto border-t border-border">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>{a.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{pretty(c)}</th>)}</tr>
          </thead>
          <tbody>
            {a.rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((v, j) => {
                  const col = a.columns[j];
                  const sid = idCol >= 0 ? String(r[idCol] ?? "") : "";
                  const linked = sid !== "" && (col === "student_id" || col === "name");
                  return (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5">
                      {linked ? <Link href={`/faculty/student/${sid}`} onClick={onNavigate} className="font-medium text-primary underline underline-offset-2">{cell(v)}</Link> : cell(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** The floating chat window for faculty and admins: the same window students get, answering from their own data scope. */
export function StaffAssistant({ role }: { role: "faculty" | "admin" }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS[role]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [saving, setSaving] = useState(true);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const path = usePathname();

  const loadConversations = useCallback(() => {
    api<{ conversations: Conversation[]; saving: boolean }>("/assistant/conversations")
      .then((r) => { setConversations(r.conversations); setSaving(r.saving); }).catch(() => { setConversations([]); setSaving(false); });
  }, []);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history = turns.slice(-4).flatMap((t) => [
      { role: "user" as const, text: t.question },
      ...(t.answer ? [{ role: "assistant" as const, text: `${t.answer.summary || t.answer.answer} (query: ${t.answer.sql ?? "none"})` }] : []),
    ]);
    setTurns((t) => [...t, { question }]); setDraft(""); setBusy(true);
    try {
      const answer = await api<Answer>("/assistant/faculty", { message: question, history, conversation_id: conversationId });
      if (answer.conversation_id) setConversationId(answer.conversation_id);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "The assistant is offline right now. Your dashboards still work; please try again shortly." } : x)));
    } finally { setBusy(false); }
  }

  async function openConversation(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const c = await api<{ id: number; messages: SavedMessage[] }>(`/assistant/conversations/${id}`);
      const restored: Turn[] = [];
      for (const m of c.messages) {
        if (m.role === "user") restored.push({ question: m.content });
        else if (restored.length) restored[restored.length - 1].answer = { ...(m.payload as Answer), summary: m.payload.summary ?? m.content };
      }
      setConversationId(c.id); setTurns(restored);
    } catch { /* keep the current chat */ } finally { setBusy(false); }
  }

  async function deleteConversation(id: number) {
    setConversations((c) => (c ?? []).filter((x) => x.id !== id));
    if (id === conversationId) newChat();
    try { await removeConversation(id); } catch { loadConversations(); }
  }

  function newChat() { setConversationId(null); setTurns([]); }

  // Fetched the first time the window opens, not on every page load.
  const loadSuggestions = () => {
    if (suggestionsLoaded) return;
    setSuggestionsLoaded(true);
    api<{ suggestions: string[] }>("/assistant/faculty/suggestions").then((r) => r.suggestions.length && setSuggestions(r.suggestions)).catch(() => {});
  };

  const lastAnswer = turns[turns.length - 1]?.answer;
  const noun = role === "admin" ? "students" : "mentees";
  // The full-page chat screen already has a chat box of its own.
  const hidden = path === "/insights/assistant";

  return (
    <AssistantShell
      title="Ask Elevra"
      subtitle={role === "faculty" ? "Your own mentees only · every answer is a read-only query" : "All students · every answer is a read-only query"}
      launcherLabel="Ask Elevra about your data" hidden={hidden} onOpen={loadSuggestions} onNew={newChat} scrollKey={turns}
      history={{
        items: conversations, activeId: conversationId, saving, onOpen: (id) => void openConversation(id), onDelete: (id) => void deleteConversation(id),
        onShow: loadConversations,
      }}
      composer={{
        id: "staff-assistant-input", label: `Ask a question about your ${noun}`, draft, busy, onChange: setDraft, onSubmit: () => void ask(draft),
        placeholder: turns.length ? "Ask a follow-up, e.g. “now only year 3”" : `Ask about your ${noun}…`,
      }}>
      {({ close }) => (
          <>
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Ask about your {noun} in plain English. I&apos;ll run a read-only query and show you the result, and I can open the page you need.</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-left text-xs text-primary hover:bg-muted">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end">
                  <p className="max-w-[92%] break-words rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">{t.question}</p>
                </div>
                {t.error && <p role="alert" className="rounded-2xl bg-risk-amber-bg px-3.5 py-2.5 text-sm text-amber-900">{t.error}</p>}
                {!t.answer && !t.error && <p className="w-fit rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">Looking at the data…</p>}
                {t.answer && (
                  <div className="min-w-0 max-w-full space-y-2.5 break-words rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                    {t.answer.mode === "data" && t.answer.asked !== t.question && (
                      <p className="text-xs text-muted-foreground">Understood as: &ldquo;{t.answer.asked.replace(/^\(Data is already limited[^)]*\)\s*/, "")}&rdquo;</p>
                    )}
                    <p>{t.answer.summary || t.answer.answer}</p>
                    {t.answer.links && t.answer.links.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {t.answer.links.map((l, j) => (
                          <Link key={l.href} href={l.href} onClick={close}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${j === 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-card text-primary hover:bg-muted"}`}>
                            {l.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    )}
                    {t.answer.chart && <ChatChart spec={t.answer.chart} />}
                    {t.answer.actions.length > 0 && (
                      <div className="rounded-lg bg-card p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary"><Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />Suggested actions</p>
                        <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">{t.answer.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                      </div>
                    )}
                    <ResultTable a={t.answer} onNavigate={close} />
                    {t.answer.sql && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Show the query{t.answer.source === "template" ? " (standard query, AI unavailable)" : ""}</summary>
                        <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-card p-2 font-mono text-[11px] text-muted-foreground">{t.answer.sql}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!busy && lastAnswer?.follow_ups && lastAnswer.follow_ups.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {lastAnswer.follow_ups.map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-primary hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
          </>
      )}
    </AssistantShell>
  );
}
