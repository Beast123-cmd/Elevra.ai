"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, History, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { ChatChart, type ChartSpec } from "@/components/insights/assistant/ChatChart";
import { deleteConversation as removeConversation, type Conversation } from "@/components/insights/assistant/conversations";

interface HackathonCard { title: string; organiser: string | null; url: string; mode: string | null; location: string | null; deadline: string | null; summary: string | null; source: string }
interface CourseCard { title: string; description: string; provider: string; url: string; tag: string; level?: string; reason?: string }
interface PageLink { label: string; href: string }
interface Reply { reply: string; chart: ChartSpec | null; cards: HackathonCard[] | null; courses?: CourseCard[] | null; links?: PageLink[] | null; follow_ups: string[]; ai: boolean; conversation_id?: number | null }
interface SavedMessage { role: "user" | "assistant"; content: string; payload: Partial<Reply> }
interface Message { role: "user" | "assistant"; text: string; reply?: Reply; error?: boolean }

const STARTERS = ["Why is my score where it is?", "What should I focus on this week?", "What if my attendance was 85%?", "Suggest a course for me", "Start a mock interview"];

const closes = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
};

/** The courses the reply actually talks about (by title); if it names none, the first few the search returned. */
function mentioned(courses: CourseCard[], reply: string): CourseCard[] {
  const named = courses.filter((c) => reply.toLowerCase().includes(c.title.toLowerCase()));
  return (named.length ? named : courses).slice(0, 3);
}

/** Renders **bold** and line breaks from the model's short replies, without injecting HTML. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() ? "" : "h-2"}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**")
            ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>)}
        </p>
      ))}
    </>
  );
}

export function StudentAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const path = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, text: m.reply?.reply ?? m.text }));
    setMessages((m) => [...m, { role: "user", text: message }]);
    setDraft(""); setBusy(true);
    try {
      const reply = await api<Reply>("/assistant/student", { message, history, conversation_id: conversationId });
      if (reply.conversation_id) setConversationId(reply.conversation_id);
      setMessages((m) => [...m, { role: "assistant", text: reply.reply, reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", error: true,
        text: "I'm offline right now, so I can't answer. Your dashboard and plan still work. Please try again in a minute." }]);
    } finally { setBusy(false); }
  }

  const loadConversations = useCallback(() => {
    api<{ conversations: Conversation[] }>("/assistant/conversations").then((r) => setConversations(r.conversations)).catch(() => setConversations([]));
  }, []);

  async function openConversation(id: number) {
    setShowHistory(false); setBusy(true);
    try {
      const c = await api<{ id: number; messages: SavedMessage[] }>(`/assistant/conversations/${id}`);
      setConversationId(c.id);
      setMessages(c.messages.map((m) => m.role === "user" ? { role: "user", text: m.content }
        : { role: "assistant", text: m.content, reply: { reply: m.content, chart: m.payload.chart ?? null, cards: m.payload.cards ?? null, courses: m.payload.courses ?? null, links: m.payload.links ?? null, follow_ups: m.payload.follow_ups ?? [], ai: m.payload.ai ?? true } }));
    } catch {
      setMessages([{ role: "assistant", error: true, text: "Couldn't open that conversation. Please try again." }]);
    } finally { setBusy(false); }
  }

  async function deleteConversation(id: number) {
    setConversations((c) => (c ?? []).filter((x) => x.id !== id));
    if (id === conversationId) newChat();
    try { await removeConversation(id); } catch { loadConversations(); }
  }

  function newChat() { setConversationId(null); setMessages([]); setShowHistory(false); }

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(draft); };
  const last = messages[messages.length - 1];
  // The interview room has its own answer box and mic at the bottom of the screen: keep the assistant out of its way.
  const hidden = path === "/student/interview";

  return (
    <>
      <div aria-hidden="true" className={hidden ? "hidden" : "h-20"} /> {/* room at the bottom of every page so content can scroll clear of the button */}
      {portalReady && createPortal(<div className={hidden ? "hidden" : "contents"}>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} aria-label="Ask Elevra, your study assistant" title="Ask Elevra"
            className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-slate-900/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4">
            <MessageCircle className="h-5 w-5" aria-hidden="true" /><span className="hidden sm:inline">Ask</span>
          </button>
        )}
        {open && (
        <section role="dialog" aria-label="Ask Elevra" aria-modal="false"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden border-2 border-primary/55 bg-card shadow-[0_24px_90px_rgba(0,0,0,0.6)] ring-2 ring-primary/25 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[calc(100vh-2.5rem)] sm:w-[400px] sm:rounded-2xl">
          <header className="flex items-center justify-between gap-2 border-b border-primary-foreground/20 bg-primary px-4 py-3 text-primary-foreground">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary-foreground">{showHistory ? "Past chats" : "Ask Elevra"}</p>
              <p className="truncate text-xs text-primary-foreground/75">{showHistory ? "Saved on your account" : "About your own record only · answers can be imperfect"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {showHistory ? (
                <button type="button" onClick={() => setShowHistory(false)} aria-label="Back to chat" className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
              ) : (
                <>
                  <button type="button" onClick={newChat} aria-label="New chat" title="New chat" className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => { setShowHistory(true); loadConversations(); }} aria-label="Past chats" title="Past chats" className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"><History className="h-4 w-4" aria-hidden="true" /></button>
                </>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md p-1.5 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {showHistory && (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {conversations === null ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
                : conversations.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No saved chats yet.</p> : (
                  <ul className="space-y-1">
                    {conversations.map((c) => (
                      <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === conversationId ? "bg-muted/60" : "hover:bg-muted"}`}>
                        <button type="button" onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                          <span className="block truncate text-sm text-foreground">{c.title}</span>
                          <span className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                        </button>
                        <button type="button" onClick={() => void deleteConversation(c.id)} aria-label={`Delete chat: ${c.title}`} className="mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}

          <div ref={scroller} className={`${showHistory ? "hidden" : "flex-1"} space-y-3 overflow-y-auto px-4 py-4`} aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Hi! I can explain your score, suggest what to work on, try &ldquo;what if&rdquo; changes and find hackathons for you.</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-primary hover:bg-muted">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-risk-amber-bg text-amber-900" : "bg-muted/60 text-foreground"}`}>
                  {m.role === "assistant" && !m.error ? <RichText text={m.text} /> : <p>{m.text}</p>}
                  {m.reply?.chart && <ChatChart spec={m.reply.chart} />}
                  {m.reply?.links && m.reply.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {m.reply.links.map((l, j) => (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${j === 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-card text-primary hover:bg-muted"}`}>
                          {l.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.reply?.courses && m.reply.courses.length > 0 && (
                    <div className="space-y-2">
                      <ul className="space-y-2">
                        {mentioned(m.reply.courses, m.text).map((c) => (
                          <li key={c.title} className="rounded-lg border border-border bg-card p-2.5">
                            <p className="text-sm font-medium text-foreground">{c.title}</p>
                            <p className="text-xs text-muted-foreground">{c.provider} · {c.tag}{c.level ? ` · ${c.level}` : ""}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                            {c.reason && <p className="mt-1 text-xs text-primary"><span className="font-semibold">Why: </span>{c.reason}</p>}
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2">
                              Explore on {c.provider} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          </li>
                        ))}
                      </ul>
                      <Link href="/student/certifications" onClick={() => setOpen(false)} className="inline-block text-xs font-semibold text-primary underline underline-offset-2">
                        See all courses in Certifications
                      </Link>
                    </div>
                  )}
                  {m.reply?.cards && m.reply.cards.length > 0 && (
                    <ul className="space-y-2">
                      {m.reply.cards.map((h) => (
                        <li key={h.url + h.title} className="rounded-lg border border-border bg-card p-2.5">
                          <p className="text-sm font-medium text-foreground">{h.title}</p>
                          <p className="text-xs text-muted-foreground">{[h.source, h.mode === "Online" ? "Online" : h.location, closes(h.deadline)].filter(Boolean).join(" · ")}</p>
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2">
                            View &amp; register <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">Elevra is thinking…</div>}
            {!busy && last?.reply?.follow_ups && last.reply.follow_ups.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {last.reply.follow_ups.map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-primary hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <label htmlFor="student-assistant-input" className="sr-only">Ask about your score, plan or hackathons</label>
            <input id="student-assistant-input" ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={busy}
              placeholder="Ask about your score, plan, hackathons…"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20" />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question"
              className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
        )}
      </div>, document.body)}
    </>
  );
}
