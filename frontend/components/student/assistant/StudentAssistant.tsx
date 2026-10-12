"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { AssistantShell } from "@/components/shared/assistant/AssistantShell";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const path = usePathname();

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
    setBusy(true);
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

  function newChat() { setConversationId(null); setMessages([]); }

  const last = messages[messages.length - 1];
  // The interview room has its own answer box and mic at the bottom of the screen: keep the assistant out of its way.
  const hidden = path === "/student/interview";

  return (
    <AssistantShell
      title="Ask Elevra" subtitle="About your own record only · answers can be imperfect" launcherLabel="Ask Elevra, your study assistant"
      hidden={hidden} onNew={newChat} scrollKey={messages}
      history={{ items: conversations, activeId: conversationId, onShow: loadConversations, onOpen: (id) => void openConversation(id), onDelete: (id) => void deleteConversation(id) }}
      composer={{ id: "student-assistant-input", label: "Ask about your score, plan or hackathons", placeholder: "Ask about your score, plan, hackathons…", draft, busy, onChange: setDraft, onSubmit: () => void ask(draft) }}>
      {({ close }) => (
        <>
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
              <div className={`max-w-[92%] min-w-0 space-y-2 break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-risk-amber-bg text-amber-900" : "bg-muted/60 text-foreground"}`}>
                {m.role === "assistant" && !m.error ? <RichText text={m.text} /> : <p>{m.text}</p>}
                {m.reply?.chart && <ChatChart spec={m.reply.chart} />}
                {m.reply?.links && m.reply.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {m.reply.links.map((l, j) => (
                      <Link key={l.href} href={l.href} onClick={close}
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
                    <Link href="/student/certifications" onClick={close} className="inline-block text-xs font-semibold text-primary underline underline-offset-2">
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
        </>
      )}
    </AssistantShell>
  );
}
