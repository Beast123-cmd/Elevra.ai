-- 003_interview_coach.sql: post-interview coaching (applied on the Mumbai project).
--
-- Post-interview coaching: remember each student's weak interview topics across interviews, and keep the practice
-- plan generated after each interview so students can tick tasks off and mentors can see progress.
--
--   interview_focus_areas    one row per student and topic ("Explaining trade-offs"), updated after every interview:
--                            how often it came up, whether it is improving, and the last interview it was assessed in.
--   interview_practice_tasks one row per practice task in the plan produced after an interview.
--
-- Per-question feedback for a single interview stays in mock_interviews.feedback (jsonb), as today.
--
-- Access (same model as 002_rls.sql): admins read everything, faculty read their mentees, students read their own
-- rows. Nobody writes through the API directly: the FastAPI backend writes with the service role after checking that
-- the row belongs to the caller. Safe to run more than once.
-- Revert: drop table if exists public.interview_practice_tasks, public.interview_focus_areas;

create table if not exists public.interview_focus_areas (
  id                   bigserial primary key,
  student_id           text not null references public.students(student_id) on delete cascade,
  topic                text not null,                       -- stable key, e.g. 'explaining-tradeoffs'
  label                text not null,                       -- shown to students, e.g. 'Explaining trade-offs'
  category             text not null check (category in ('communication','technical_depth','problem_solving','project_knowledge')),
  status               text not null default 'open' check (status in ('open','improving','resolved')),
  times_seen           int  not null default 1 check (times_seen >= 1),
  last_result          text check (last_result in ('gap','improved','resolved')),
  first_interview_id   bigint references public.mock_interviews(id) on delete set null,
  last_interview_id    bigint references public.mock_interviews(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (student_id, topic)
);
create index if not exists interview_focus_areas_student_idx on public.interview_focus_areas (student_id, status);

create table if not exists public.interview_practice_tasks (
  id             bigserial primary key,
  student_id     text   not null references public.students(student_id) on delete cascade,
  interview_id   bigint not null references public.mock_interviews(id) on delete cascade,
  focus_area_id  bigint references public.interview_focus_areas(id) on delete set null,
  day            int    not null check (day between 1 and 14),
  task           text   not null,
  done           boolean not null default false,
  done_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists interview_practice_tasks_student_idx on public.interview_practice_tasks (student_id, interview_id);

-- ---------- row-level security ----------
alter table public.interview_focus_areas   enable row level security;
alter table public.interview_practice_tasks enable row level security;

drop policy if exists rls_read on public.interview_focus_areas;
create policy rls_read on public.interview_focus_areas for select to authenticated
  using (private.can_see_student(student_id));

drop policy if exists rls_read on public.interview_practice_tasks;
create policy rls_read on public.interview_practice_tasks for select to authenticated
  using (private.can_see_student(student_id));

revoke all privileges on table public.interview_focus_areas, public.interview_practice_tasks from anon, authenticated;
grant select on table public.interview_focus_areas, public.interview_practice_tasks to authenticated;
