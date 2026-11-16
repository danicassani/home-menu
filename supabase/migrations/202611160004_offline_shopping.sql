begin;
alter table public.household_members add column membership_id uuid not null default gen_random_uuid();
-- Receipts outlive removed products, so a lost response can never replay an old mark.
create table public.shopping_mark_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 household_id uuid not null references public.households(id) on delete cascade,
 week_start date not null check(extract(isodow from week_start)=1),
 item_id uuid not null,
 purchased boolean not null,
 applied boolean not null,
 primary key(user_id,operation_id)
);
alter table public.shopping_mark_receipts enable row level security;
revoke all on public.shopping_mark_receipts from public,anon,authenticated;
create index shopping_mark_receipts_house on public.shopping_mark_receipts(household_id);
create function public.apply_shopping_mark(p_operation uuid,p_house uuid,p_membership uuid,p_week date,p_item uuid,p_purchased boolean)
returns text language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); previous public.shopping_mark_receipts; applied boolean;
begin
 if h is distinct from p_house then raise exception 'Casa no disponible'; end if;
 if p_membership is null or not exists(select 1 from public.household_members where user_id=auth.uid() and household_id=h and membership_id=p_membership) then raise exception 'Pertenencia caducada'; end if;
 if p_operation is null or p_item is null or p_purchased is null or p_week is null or extract(isodow from p_week)<>1 then
  raise exception 'Marca inválida';
 end if;
 select * into previous from public.shopping_mark_receipts where user_id=auth.uid() and operation_id=p_operation;
 if found then
  if previous.household_id<>p_house or previous.week_start<>p_week or previous.item_id<>p_item or previous.purchased<>p_purchased then
   raise exception 'Identificador de operación reutilizado';
  end if;
  return case when previous.applied then 'applied' else 'stale' end;
 end if;
 update public.shopping_items set purchased=p_purchased where id=p_item and household_id=h and week_start=p_week;
 applied:=found;
 insert into public.shopping_mark_receipts values(auth.uid(),p_operation,h,p_week,p_item,p_purchased,applied);
 return case when applied then 'applied' else 'stale' end;
end $$;
revoke all on function public.apply_shopping_mark(uuid,uuid,uuid,date,uuid,boolean) from public,anon;
grant execute on function public.apply_shopping_mark(uuid,uuid,uuid,date,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
