-- Physical rewards can be requested with earned coins. Redemptions are atomic and stock-safe.
create table if not exists public.student_store_items (
  item_id text primary key,
  title text not null,
  description text not null,
  cost_coins integer not null check (cost_coins > 0),
  image_path text not null,
  stock integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.student_store_redemptions (
  id bigserial primary key,
  student_id text not null references public.students(student_id) on delete cascade,
  item_id text not null references public.student_store_items(item_id),
  coins_spent integer not null check (coins_spent > 0),
  status text not null default 'requested' check (status in ('requested','approved','fulfilled','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists student_store_redemptions_student_created_idx
  on public.student_store_redemptions (student_id, created_at desc);

alter table public.student_store_items enable row level security;
alter table public.student_store_redemptions enable row level security;

drop policy if exists student_store_items_read on public.student_store_items;
create policy student_store_items_read on public.student_store_items
  for select to authenticated using (active);

drop policy if exists student_store_redemptions_read_own on public.student_store_redemptions;
create policy student_store_redemptions_read_own on public.student_store_redemptions
  for select to authenticated using (student_id = private.jwt_student_id());

revoke all on public.student_store_items, public.student_store_redemptions from anon, authenticated;
grant select on public.student_store_items, public.student_store_redemptions to authenticated;
grant all on public.student_store_items, public.student_store_redemptions to service_role;
grant usage, select on sequence public.student_store_redemptions_id_seq to service_role;

insert into public.student_store_items (item_id,title,description,cost_coins,image_path,stock,sort_order) values
  ('elevra-stickers','Elevra sticker pack','A set of mint and forest-green laptop stickers.','50','/images/elevra-merch-stickers.webp',100,1),
  ('elevra-pen','Elevra click pen','A smooth-writing pen with a mint clip.','100','/images/elevra-merch-pen.webp',100,2),
  ('elevra-cap','Elevra campus cap','A forest-green cap with a subtle Elevra mark.','300','/images/elevra-merch-cap.webp',40,3),
  ('elevra-tshirt','Elevra T-shirt','A soft cotton tee with the Elevra emblem.','500','/images/elevra-merch-tshirt.webp',30,4),
  ('elevra-backpack','Elevra backpack','A durable everyday backpack in Elevra green.','800','/images/elevra-merch-backpack.webp',20,5)
on conflict (item_id) do update set title=excluded.title, description=excluded.description,
  cost_coins=excluded.cost_coins, image_path=excluded.image_path, sort_order=excluded.sort_order;

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
