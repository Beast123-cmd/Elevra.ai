"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lightbulb, Plus, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { ChatChart, type ChartSpec } from "./ChatChart";
import { deleteConversation, when, type Conversation } from "./conversations";

interface Answer {
  question: string; asked: string; answer: string; sql: string | null; columns: string[]; rows: (string | number | boolean | null)[][];
  row_count: number; truncated: boolean; source: "ai" | "template" | "none";
  chart: ChartSpec | null; summary: string; actions: string[]; follow_ups: string[]; conversation_id?: number | null;
}
interface Turn { question: string; answer?: Answer; error?: string }

const FALLBACK_SUGGESTIONS = [
  "Which of my mentees need attention first?", "How many of my mentees are below 75% attendance?",
  "Average success score of my mentees by year", "Placement risk of my mentees by department",
];
const pretty = (s: string) => s.replace(/_/g, " ");
const cell = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

function ResultTable({ a }: { a: Answer }) {
  if (a.rows.length === 0) return null;
  return (
    <details className="rounded-lg border border-[#e2ebe6] bg-white" open={!a.chart}>
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600">
        Results table · {a.row_count} row{a.row_count === 1 ? "" : "s"}{a.truncated ? " (first 200 shown)" : ""}
      </summary>
      <div className="max-h-80 overflow-auto border-t border-[#eef3f0]">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-[#f7faf8] text-slate-500">
            <tr>{a.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{pretty(c)}</th>)}</tr>
          </thead>
          <tbody>
            {a.rows.map((r, i) => (
              <tr key={i} className="border-t border-[#eef3f0]">{r.map((v, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5">{cell(v)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function FacultyAssistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_SUGGESTIONS);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [saving, setSaving] = useState(true);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setRole((data.session?.user.app_metadata?.role as string) ?? null));
    api<{ suggestions: string[] }>("/assistant/faculty/suggestions").then((r) => setSuggestions(r.suggestions)).catch(() => {});
    loadConversations();
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

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
      if (answer.conversation_id) { if (answer.conversation_id !== conversationId) loadConversations(); setConversationId(answer.conversation_id); }
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: "The assistant is offline right now. Your dashboards still work; please try again shortly." } : x)));
    } finally { setBusy(false); }
  }

  function loadConversations() {
    api<{ conversations: Conversation[]; saving: boolean }>("/assistant/conversations")
      .then((r) => { setConversations(r.conversations); setSaving(r.saving); }).catch(() => setSaving(false));
  }

  async function openConversation(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const c = await api<{ id: number; messages: { role: "user" | "assistant"; content: string; payload: Partial<Answer> }[] }>(`/assistant/conversations/${id}`);
      const restored: Turn[] = [];
      for (const m of c.messages) {
        if (m.role === "user") restored.push({ question: m.content });
        else if (restored.length) restored[restored.length - 1].answer = { ...(m.payload as Answer), summary: m.payload.summary ?? m.content };
      }
      setConversationId(c.id); setTurns(restored);
    } catch { /* keep the current chat */ } finally { setBusy(false); }
  }

  async function removeConversation(id: number) {
    setConversations((c) => c.filter((x) => x.id !== id));
    if (id === conversationId) newChat();
    try { await deleteConversation(id); } catch { loadConversations(); }
  }

  function newChat() { setConversationId(null); setTurns([]); }

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(draft); };
  const lastAnswer = turns[turns.length - 1]?.answer;

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start" aria-label="Past chats">
        <button type="button" onClick={newChat} disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#dce7e1] bg-white px-3 py-2 text-sm font-semibold text-[#18574e] hover:bg-[#f1f6f3] disabled:opacity-50">
          <Plus className="h-4 w-4" aria-hidden="true" />New chat
        </button>
        <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Past chats</p>
        {!saving ? <p className="px-1 text-xs text-slate-500">Chats aren&apos;t being saved right now.</p>
          : conversations.length === 0 ? <p className="px-1 text-xs text-slate-500">Your questions will be saved here.</p> : (
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[70vh]">
              {conversations.map((c) => (
                <li key={c.id} className={`flex items-center gap-1 rounded-lg ${c.id === conversationId ? "bg-[#eaf3ef]" : "hover:bg-[#f7faf8]"}`}>
                  <button type="button" onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                    <span className="block truncate text-sm text-[#172824]">{c.title}</span>
                    <span className="text-[11px] text-slate-500">{when(c.updated_at)}</span>
                  </button>
                  <button type="button" onClick={() => void removeConversation(c.id)} aria-label={`Delete chat: ${c.title}`}
                    className="mr-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
      </aside>
      <div className="min-w-0 space-y-4">
      <p className="text-sm text-slate-500">
        Ask about your {role === "admin" ? "students" : "mentees"} in plain English. Every answer is a read-only query you can inspect.
        {role === "faculty" && " Results only ever include your own mentees."}
      </p>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-[#dce7e1] bg-white px-3 py-1.5 text-sm text-[#18574e] hover:bg-[#eaf3ef]">{s}</button>
          ))}
        </div>
      )}

      <ol className="space-y-5" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-[#18574e] px-4 py-2.5 text-sm text-white">{t.question}</p>
            {t.error && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t.error}</p>}
            {!t.answer && !t.error && <p className="w-fit rounded-2xl bg-[#f1f6f3] px-4 py-2.5 text-sm text-slate-500">Looking at the data…</p>}
            {t.answer && (
              <div className="space-y-3 rounded-2xl border border-[#dce7e1] bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
                {t.answer.asked !== t.question && <p className="text-xs text-slate-500">Understood as: &ldquo;{t.answer.asked.replace(/^\(Data is already limited[^)]*\)\s*/, "")}&rdquo;</p>}
                <p className="text-sm leading-relaxed text-[#172824]">{t.answer.summary || t.answer.answer}</p>
                {t.answer.chart && <ChatChart spec={t.answer.chart} />}
                {t.answer.actions.length > 0 && (
                  <div className="rounded-lg bg-[#f7faf8] p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#18574e]"><Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />Suggested actions</p>
                    <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-700">{t.answer.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                  </div>
                )}
                <ResultTable a={t.answer} />
                {t.answer.sql && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-500">Show the query{t.answer.source === "template" ? " (standard query, AI unavailable)" : ""}</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 font-mono text-[11px] text-slate-700">{t.answer.sql}</pre>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!busy && lastAnswer?.follow_ups && lastAnswer.follow_ups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lastAnswer.follow_ups.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-[#dce7e1] bg-white px-3 py-1.5 text-xs text-[#18574e] hover:bg-[#eaf3ef]">{s}</button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-3 flex items-center gap-2 rounded-xl border border-[#dce7e1] bg-white p-2 shadow-sm">
        <label htmlFor="faculty-assistant-input" className="sr-only">Ask a question about your students</label>
        <input id="faculty-assistant-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={busy}
          placeholder={turns.length ? "Ask a follow-up, e.g. “now only year 3”" : "e.g. Which mentees have attendance below 65%?"}
          className="h-10 min-w-0 flex-1 rounded-lg px-3 text-sm text-[#172824] outline-none" />
        <button type="submit" disabled={busy || !draft.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#18574e] px-4 text-sm font-semibold text-white hover:bg-[#12473f] disabled:opacity-50">
          <Send className="h-4 w-4" aria-hidden="true" />Ask
        </button>
      </form>
      <div ref={end} />
      </div>
    </div>
  );
}
