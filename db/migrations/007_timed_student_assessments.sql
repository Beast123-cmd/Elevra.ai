-- One timed assessment per student, period, topic, and difficulty.
create table if not exists public.student_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  mode text not null check (mode in ('daily','weekly')),
  category text not null check (category in ('aptitude','sql','cpp','mcq','coding')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  period_key text not null,
  question_ids jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  total_questions integer not null check (total_questions in (10,50)),
  correct_count integer,
  score_percent integer,
  coins integer not null default 0 check (coins >= 0),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, mode, category, difficulty, period_key)
);
create index if not exists student_assessment_sessions_student_idx
  on public.student_assessment_sessions (student_id, status, created_at desc);

alter table public.student_assessment_sessions enable row level security;
drop policy if exists student_assessment_sessions_read_own on public.student_assessment_sessions;
create policy student_assessment_sessions_read_own on public.student_assessment_sessions
  for select to authenticated using (student_id = private.jwt_student_id());
revoke all on public.student_assessment_sessions from anon, authenticated;
grant select on public.student_assessment_sessions to authenticated;
grant all on public.student_assessment_sessions to service_role;

-- Include timed test coins when checking balances during store redemption.
create or replace function public.redeem_student_store_item(p_student_id text, p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  item public.student_store_items%rowtype;
  balance bigint;
  redemption public.student_store_redemptions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id, 514));
  select * into item from public.student_store_items where item_id = p_item_id and active for update;
  if not found then raise exception 'Reward not found' using errcode = 'P0001'; end if;
  if item.stock < 1 then raise exception 'Reward is out of stock' using errcode = 'P0001'; end if;

  select coalesce((select sum(coins) from public.student_daily_logins where student_id=p_student_id),0)
       + coalesce((select sum(coins) from public.student_daily_challenge_attempts where student_id=p_student_id),0)
       + coalesce((select sum(coins) from public.student_assessment_sessions where student_id=p_student_id and status='completed'),0)
       - coalesce((select sum(coins_spent) from public.student_store_redemptions where student_id=p_student_id and status <> 'cancelled'),0)
    into balance;
  if balance < item.cost_coins then raise exception 'Not enough coins' using errcode = 'P0001'; end if;

  update public.student_store_items set stock = stock - 1 where item_id = p_item_id;
  insert into public.student_store_redemptions(student_id,item_id,coins_spent)
    values (p_student_id,p_item_id,item.cost_coins) returning * into redemption;
  return jsonb_build_object('id',redemption.id,'item_id',redemption.item_id,'coins_spent',redemption.coins_spent,
    'status',redemption.status,'created_at',redemption.created_at,'balance',balance-item.cost_coins);
end;
$$;
revoke all on function public.redeem_student_store_item(text,text) from public, anon, authenticated;
grant execute on function public.redeem_student_store_item(text,text) to service_role;
