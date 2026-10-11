export type ChatErrorKind = "question" | "access" | "offline";

/** Query-result cells arrive as JSON: nulls, numbers, booleans and strings. */
export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  return String(v);
}

/**
 * lib/api.ts throws `API <path> failed: <status>` for HTTP errors and a TypeError when the network or API is down.
 * 422 means the question was rejected, 401/403 mean no access, anything else is treated as the API being offline,
 * so the page can say what to do about it.
 */
export function describeChatError(e: unknown): { kind: ChatErrorKind; message: string } {
  const status = e instanceof Error ? /failed: (\d{3})/.exec(e.message)?.[1] : undefined;
  if (status === "422") return { kind: "question", message: "That question could not be used. Keep it under 300 characters and ask about students, risk or scores." };
  if (status === "401" || status === "403") return { kind: "access", message: "Only administrators can use the data assistant. Sign in again with an admin account." };
  return { kind: "offline", message: "The data assistant is offline right now. Every dashboard still works; try again in a minute." };
}

/** Mirrors the backend's suggested questions so the chips show even before the first request. */
export const SUGGESTIONS = [
  "Show academic risk by department",
  "Who are the 10 highest-priority students?",
  "How many students are in each segment?",
  "Which strong students are not placement ready?",
  "Which students are below 65% attendance?",
  "What is the average success score by department?",
];
