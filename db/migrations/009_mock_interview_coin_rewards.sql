-- Include score-based mock interview awards in store purchase balances.
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
       + coalesce((select sum(case when feedback->>'coins_awarded' ~ '^[0-9]+$' then (feedback->>'coins_awarded')::integer else 0 end)
                   from public.mock_interviews where student_id=p_student_id),0)
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
