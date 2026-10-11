"use client";
import { useEffect, useState } from "react";
import { describeChatError, formatCell, SUGGESTIONS, type ChatErrorKind } from "@/components/admin/chatUi";
import { EmptyState } from "@/components/shared/Kpi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

interface Answer {
  question: string; answer: string; sql: string | null; columns: string[]; rows: unknown[][];
  row_count: number; truncated: boolean; source: "ai" | "template" | "none"; suggestions?: string[];
}

const SOURCE_LABEL: Record<Answer["source"], string> = { ai: "AI-written query", template: "Standard query", none: "No query run" };

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<{ kind: ChatErrorKind; message: string } | null>(null);

  // Cheap request on load: it makes the API open its database connection now, so the first real question is not slow.
  useEffect(() => {
    api("/chat/suggestions").catch(() => undefined);
  }, []);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion(text);
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Answer>("/chat", { question: text }));
    } catch (e) {
      setResult(null);
      setError(describeChatError(e));
    } finally {
      setBusy(false);
    }
  }

  const chips = result?.suggestions ?? SUGGESTIONS;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold leading-tight tracking-tight">Ask your data</h1>
      </div>

      <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] space-y-3 p-4">
        <div className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm"
            placeholder="e.g. Which year 4 students have a success score below 45?"
            maxLength={300}
            data-tour="admin-chat-question"
            value={question}
            disabled={busy}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            aria-label="Your question"
          />
          <Button disabled={busy || question.trim().length < 3} onClick={() => ask(question)}>
            {busy ? "Thinking…" : "Ask"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {chips.map((s) => (
            <button key={s} disabled={busy} onClick={() => ask(s)} className="rounded-full border border-input bg-card px-3 py-1 text-xs text-foreground hover:bg-muted/60 disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      </Card>

      {busy && <p className="text-sm text-muted-foreground">Working on it…</p>}
      {error && <EmptyState>{error.message}</EmptyState>}

      {result && !busy && (
        <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm font-medium">{result.answer}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs ${result.source === "ai" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {SOURCE_LABEL[result.source]}
            </span>
          </div>

          {result.sql && result.row_count === 0 && <p className="text-sm text-muted-foreground">No students match that.</p>}

          {result.rows.length > 0 && (
            <>
              <div className="max-h-96 overflow-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>{result.columns.map((c) => <th key={c} className="p-2">{c.replace(/_/g, " ")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.map((cell, j) => <td key={j} className="p-2">{formatCell(cell)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.row_count} row{result.row_count === 1 ? "" : "s"}
                {result.truncated && " · showing the first 200 only; narrow your question to see the rest"}
              </p>
            </>
          )}

          {result.sql && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Show the query that was run</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-slate-100">{result.sql}</pre>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
