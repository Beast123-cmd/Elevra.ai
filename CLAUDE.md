# Elevra.ai: agent rules (Claude Code and Codex)

Read `docs/PRD.md` and `docs/BUILD_PLAN.md` before doing anything. Three people work in parallel, and each owns specific folders.
**Start every session by asking the user who they are**, unless they have already said ("I am Utki, role C").

- **Aayush (A, data, owns `main`: merges PRs, branch protection):** `pipeline/`, `db/migrations/`, `data/`, `backend/routers/whatif.py`, `docs/SCORE_METHODOLOGY.md`
- **Mahesh (B, admin/faculty, hour-0 skeleton, deploys):** `frontend/app/admin/`, `frontend/app/faculty/`, `frontend/components/admin/`,
  `frontend/components/faculty/`, `frontend/components/shared/`, `backend/routers/admin.py`, `faculty.py`, `chat.py`, `briefs.py`
- **Utki (C, student/insights):** `frontend/app/student/`, `frontend/components/student/`, `frontend/app/insights/`,
  `frontend/app/demo/`, `frontend/components/insights/`, `backend/routers/student.py`, `interview.py`, `tts.py`, `docs/slides*`

## Rules
1. Only create or edit files inside the current user's folders.
2. NEVER modify these (frozen after hour 0; changes are made only on `main`, via Aayush): `package.json`, `package-lock.json`,
   `requirements.txt`, `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/login/`, `frontend/middleware.ts`,
   `frontend/lib/`, `frontend/components/ui/`, `backend/main.py`, `backend/common/`, `CLAUDE.md`, `AGENTS.md`,
   `docs/PRD.md`, `docs/BUILD_PLAN.md`, `.env*`.
3. Do not install packages. If one is needed, stop and tell the user to ask Aayush (main owner).
4. Do not change the DB schema. Read it from `db/migrations/`. Schema changes are new migration files written by Aayush.
5. Read data from Supabase (`student_unified_view`, `scores`, `analytics`, ...) using `frontend/lib/supabase/*` or
   `backend/common/db.py`. Use the types in `frontend/lib/types.ts`. Never invent new shapes.
6. All scoring logic lives in `pipeline/scoring/engine.py`. Never re-implement a formula anywhere else; import it.
7. If a task needs a change outside the user's folders, stop and explain what change is needed and who owns it.
8. Never commit secrets. Server keys (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`) must never
   appear in frontend code. Every AI call needs a non-AI fallback, and the UI must show an "offline" state if the API fails.
9. Every page needs loading, empty and error states. Risk wording is "needs a check-in", never "will fail".
10. Run `git status` before committing and stage only your own folders (never `git add .`). Commit prefixes:
    `data:`, `admin:`, `faculty:`, `student:`, `fix:`.
11. Do not copy code from other teams' public repos (rulebook §26).

Stack: Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui + Recharts + @supabase/ssr; FastAPI + Python;
Postgres on Supabase; pandas/scikit-learn pipeline; Gemini + ElevenLabs; Vercel (web) + Hostinger VPS (API).
