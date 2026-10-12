"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, History, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { when, type Conversation } from "@/components/insights/assistant/conversations";

export interface AssistantHistory {
  items: Conversation[] | null;
  activeId: number | null;
  /** false when the API says chats are not being saved right now */
  saving?: boolean;
  onShow: () => void;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
}

export interface AssistantComposer {
  id: string;
  label: string;
  placeholder: string;
  draft: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

interface Props {
  title: string;
  subtitle: string;
  historySubtitle?: string;
  launcherLabel: string;
  /** hides the launcher and window, e.g. on a page that already has its own chat box */
  hidden?: boolean;
  /** runs each time the window is opened, e.g. to load suggestions */
  onOpen?: () => void;
  history: AssistantHistory;
  onNew: () => void;
  composer: AssistantComposer;
  /** changes whenever the conversation grows, so the window scrolls to the newest message */
  scrollKey: unknown;
  children: (api: { close: () => void }) => ReactNode;
}

const ICON_BUTTON = "grid h-9 w-9 place-items-center rounded-md text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground sm:h-8 sm:w-8";

/**
 * The floating chat window shared by students, faculty and admins: a launcher button, a window that fills the screen on
 * phones and floats bottom-right from tablet up, a header with new/history/close, the message area and the composer.
 * What goes inside the message area is up to the role (children).
 */
export function AssistantShell({ title, subtitle, historySubtitle = "Saved on your account", launcherLabel, hidden = false, onOpen, history, onNew, composer, scrollKey, children }: Props) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setPortalReady(true), []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [scrollKey, composer.busy]);
  useEffect(() => { if (open && !showHistory) input.current?.focus(); }, [open, showHistory]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  // When the window covers the whole screen (phones), the page behind it must not scroll under the finger.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const submit = (e: FormEvent) => { e.preventDefault(); composer.onSubmit(); };
  const startNew = () => { setShowHistory(false); onNew(); };
  const openConversation = (id: number) => { setShowHistory(false); history.onOpen(id); };

  return (
    <>
      <div aria-hidden="true" className={hidden ? "hidden" : "h-20"} /> {/* room at the bottom of every page so content can scroll clear of the button */}
      {portalReady && createPortal(<div className={hidden ? "hidden" : "contents"}>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); onOpen?.(); }} aria-label={launcherLabel} title={launcherLabel}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-slate-900/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4">
            <MessageCircle className="h-5 w-5" aria-hidden="true" /><span className="hidden sm:inline">Ask</span>
          </button>
        )}
        {open && (
        <section role="dialog" aria-label={title} aria-modal="false"
          className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-2 border-primary/55 bg-card shadow-[0_24px_90px_rgba(0,0,0,0.6)] ring-2 ring-primary/25 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[min(400px,calc(100vw-2.5rem))] sm:rounded-2xl md:w-[420px] lg:w-[440px]">
          <header className="flex items-center justify-between gap-2 border-b border-primary-foreground/20 bg-primary px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-primary-foreground sm:pt-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary-foreground">{showHistory ? "Past chats" : title}</p>
              <p className="truncate text-xs text-primary-foreground/75">{showHistory ? historySubtitle : subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {showHistory ? (
                <button type="button" onClick={() => setShowHistory(false)} aria-label="Back to chat" className={ICON_BUTTON}><ArrowLeft className="h-4 w-4" aria-hidden="true" /></button>
              ) : (
                <>
                  <button type="button" onClick={startNew} aria-label="New chat" title="New chat" className={ICON_BUTTON}><Plus className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => { setShowHistory(true); history.onShow(); }} aria-label="Past chats" title="Past chats" className={ICON_BUTTON}><History className="h-4 w-4" aria-hidden="true" /></button>
                </>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className={ICON_BUTTON}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {showHistory && (
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {history.saving === false ? <p className="px-2 py-3 text-sm text-muted-foreground">Chats aren&apos;t being saved right now.</p>
                : history.items === null ? <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
                : history.items.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">No saved chats yet.</p> : (
                  <ul className="space-y-1">
                    {history.items.map((c) => (
                      <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === history.activeId ? "bg-muted/60" : "hover:bg-muted"}`}>
                        <button type="button" onClick={() => openConversation(c.id)} className="min-h-11 min-w-0 flex-1 px-3 py-2 text-left">
                          <span className="block truncate text-sm text-foreground">{c.title}</span>
                          <span className="text-xs text-muted-foreground">{when(c.updated_at)}</span>
                        </button>
                        <button type="button" onClick={() => history.onDelete(c.id)} aria-label={`Delete chat: ${c.title}`} className="mr-1 grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-700">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}

          <div ref={scroller} className={`${showHistory ? "hidden" : "flex-1"} min-h-0 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4`} aria-live="polite">
            {children({ close: () => setOpen(false) })}
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            <label htmlFor={composer.id} className="sr-only">{composer.label}</label>
            {/* 16px on phones: smaller text makes iOS zoom the page when the box is focused */}
            <input id={composer.id} ref={input} value={composer.draft} onChange={(e) => composer.onChange(e.target.value)} maxLength={500} disabled={composer.busy}
              placeholder={composer.placeholder} enterKeyHint="send" autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 sm:h-10 sm:text-sm" />
            <button type="submit" disabled={composer.busy || !composer.draft.trim()} aria-label="Send question"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:h-10 sm:w-10">
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
        )}
      </div>, document.body)}
    </>
  );
}
