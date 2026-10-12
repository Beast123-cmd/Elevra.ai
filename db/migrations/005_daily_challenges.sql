-- Student daily check-in and challenge coins. Awards are written only by the authenticated API.
create table if not exists public.student_daily_logins (
  student_id text not null references public.students(student_id) on delete cascade,
  activity_date date not null,
  streak_days integer not null check (streak_days > 0),
  coins integer not null check (coins >= 0),
  created_at timestamptz not null default now(),
  primary key (student_id, activity_date)
);

create table if not exists public.student_daily_challenge_attempts (
  id bigserial primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  activity_date date not null,
  category text not null check (category in ('aptitude','coding','mcq')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  question_id text not null,
  answer text not null,
  correct boolean not null,
  coins integer not null check (coins >= 0),
  created_at timestamptz not null default now(),
  unique (student_id, activity_date, category, difficulty)
);

alter table public.student_daily_logins enable row level security;
alter table public.student_daily_challenge_attempts enable row level security;

drop policy if exists student_daily_logins_read_own on public.student_daily_logins;
create policy student_daily_logins_read_own on public.student_daily_logins
  for select to authenticated using (student_id = private.jwt_student_id());

drop policy if exists student_daily_attempts_read_own on public.student_daily_challenge_attempts;
create policy student_daily_attempts_read_own on public.student_daily_challenge_attempts
  for select to authenticated using (student_id = private.jwt_student_id());

revoke all on public.student_daily_logins, public.student_daily_challenge_attempts from anon, authenticated;
grant select on public.student_daily_logins, public.student_daily_challenge_attempts to authenticated;
grant all on public.student_daily_logins, public.student_daily_challenge_attempts to service_role;
grant usage, select on sequence public.student_daily_challenge_attempts_id_seq to service_role;
