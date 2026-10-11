"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ExternalLink, MessageCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { ChatChart, type ChartSpec } from "@/components/insights/assistant/ChatChart";

interface HackathonCard { title: string; organiser: string | null; url: string; mode: string | null; location: string | null; deadline: string | null; summary: string | null; source: string }
interface Reply { reply: string; chart: ChartSpec | null; cards: HackathonCard[] | null; follow_ups: string[]; ai: boolean }
interface Message { role: "user" | "assistant"; text: string; reply?: Reply; error?: boolean }

const STARTERS = ["Why is my score where it is?", "What should I focus on this week?", "What if my attendance was 85%?", "Any hackathons for me?"];

const closes = (iso: string | null) => {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
};

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
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

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
      const reply = await api<Reply>("/assistant/student", { message, history });
      setMessages((m) => [...m, { role: "assistant", text: reply.reply, reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", error: true,
        text: "I'm offline right now, so I can't answer. Your dashboard and plan still work. Please try again in a minute." }]);
    } finally { setBusy(false); }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(draft); };
  const last = messages[messages.length - 1];

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Ask Elevra, your study assistant"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#18574e] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-[#12473f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />Ask Elevra
        </button>
      )}
      {open && (
        <section role="dialog" aria-label="Ask Elevra" aria-modal="false"
          className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[calc(100vh-2.5rem)] sm:w-[400px] sm:rounded-2xl sm:border sm:border-[#dce7e1] sm:shadow-2xl sm:shadow-slate-900/20">
          <header className="flex items-center justify-between gap-3 border-b border-[#dce7e1] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[#172824]">Ask Elevra</p>
              <p className="text-xs text-slate-500">About your own record only · answers can be imperfect</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Hi! I can explain your score, suggest what to work on, try &ldquo;what if&rdquo; changes and find hackathons for you.</p>
                <div className="flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-[#dce7e1] bg-[#f7faf8] px-3 py-1.5 text-xs text-[#18574e] hover:bg-[#eaf3ef]">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-[#18574e] text-white" : m.error ? "bg-amber-50 text-amber-900" : "bg-[#f1f6f3] text-[#172824]"}`}>
                  {m.role === "assistant" && !m.error ? <RichText text={m.text} /> : <p>{m.text}</p>}
                  {m.reply?.chart && <ChatChart spec={m.reply.chart} />}
                  {m.reply?.cards && m.reply.cards.length > 0 && (
                    <ul className="space-y-2">
                      {m.reply.cards.map((h) => (
                        <li key={h.url + h.title} className="rounded-lg border border-[#e2ebe6] bg-white p-2.5">
                          <p className="text-sm font-medium text-[#172824]">{h.title}</p>
                          <p className="text-xs text-slate-500">{[h.source, h.mode === "Online" ? "Online" : h.location, closes(h.deadline)].filter(Boolean).join(" · ")}</p>
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#286a62] underline underline-offset-2">
                            View &amp; register <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl bg-[#f1f6f3] px-3.5 py-2.5 text-sm text-slate-500">Elevra is thinking…</div>}
            {!busy && last?.reply?.follow_ups && last.reply.follow_ups.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {last.reply.follow_ups.map((s) => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-[#dce7e1] bg-white px-3 py-1.5 text-xs text-[#18574e] hover:bg-[#eaf3ef]">{s}</button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-[#dce7e1] p-3">
            <label htmlFor="student-assistant-input" className="sr-only">Ask about your score, plan or hackathons</label>
            <input id="student-assistant-input" ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} disabled={busy}
              placeholder="Ask about your score, plan, hackathons…"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#dce7e1] bg-white px-3 text-sm text-[#172824] outline-none focus:border-[#74a99b] focus:ring-2 focus:ring-[#286a62]/15" />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question"
              className="grid h-10 w-10 place-items-center rounded-lg bg-[#18574e] text-white hover:bg-[#12473f] disabled:opacity-50">
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
