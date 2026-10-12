-- Keep physical rewards aspirational; the least expensive item costs 5,000 coins.
update public.student_store_items
set cost_coins = case item_id
  when 'elevra-stickers' then 5000
  when 'elevra-pen' then 7500
  when 'elevra-cap' then 15000
  when 'elevra-tshirt' then 25000
  when 'elevra-backpack' then 40000
end
where item_id in ('elevra-stickers', 'elevra-pen', 'elevra-cap', 'elevra-tshirt', 'elevra-backpack');
