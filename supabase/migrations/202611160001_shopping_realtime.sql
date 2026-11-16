begin;
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null check(extract(isodow from week_start)=1),
  ingredient_id uuid not null,
  from_menu boolean not null default false,
  manual boolean not null default false,
  purchased boolean not null default false,
  check(from_menu or manual),
  unique(household_id,week_start,ingredient_id),
  foreign key(ingredient_id,household_id) references public.ingredients(id,household_id)
);
alter table public.shopping_items enable row level security;
create policy shopping_read on public.shopping_items for select to authenticated using(household_id=public.my_household());
revoke all on public.shopping_items from anon,authenticated;
grant select on public.shopping_items to authenticated;

create function public.reconcile_shopping_week(p_house uuid,p_week date) returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.shopping_items(household_id,week_start,ingredient_id,from_menu)
  select distinct p_house,p_week,coalesce(c.alternative_id,l.ingredient_id),true
  from public.menu_entries e join public.recipe_ingredients l on l.recipe_id=e.recipe_id
  left join public.menu_choices c on c.entry_id=e.id and c.ingredient_id=l.ingredient_id
  where e.household_id=p_house and e.week_start=p_week
  on conflict(household_id,week_start,ingredient_id) do update set from_menu=true where not public.shopping_items.from_menu;
  delete from public.shopping_items s where s.household_id=p_house and s.week_start=p_week and not s.manual and not exists(
    select 1 from public.menu_entries e join public.recipe_ingredients l on l.recipe_id=e.recipe_id
    left join public.menu_choices c on c.entry_id=e.id and c.ingredient_id=l.ingredient_id
    where e.household_id=p_house and e.week_start=p_week and coalesce(c.alternative_id,l.ingredient_id)=s.ingredient_id
  );
  update public.shopping_items s set from_menu=false where s.household_id=p_house and s.week_start=p_week and s.manual and s.from_menu and not exists(
    select 1 from public.menu_entries e join public.recipe_ingredients l on l.recipe_id=e.recipe_id
    left join public.menu_choices c on c.entry_id=e.id and c.ingredient_id=l.ingredient_id
    where e.household_id=p_house and e.week_start=p_week and coalesce(c.alternative_id,l.ingredient_id)=s.ingredient_id
  );
end $$;
revoke all on function public.reconcile_shopping_week(uuid,date) from public,anon,authenticated;

create function public.get_shopping_week(p_week date) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household();
begin
  if h is null then raise exception 'Casa requerida'; end if;
  if p_week is null or extract(isodow from p_week)<>1 then raise exception 'La semana debe empezar en lunes'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'ingredient_id',s.ingredient_id,'name',i.name,'from_menu',s.from_menu,'manual',s.manual,'purchased',s.purchased) order by lower(i.name),s.id)
    from public.shopping_items s join public.ingredients i on i.id=s.ingredient_id where s.household_id=h and s.week_start=p_week),'[]'::jsonb);
end $$;
create function public.set_shopping_purchased(p_item uuid,p_purchased boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); w date;
begin
  if p_purchased is null then raise exception 'Estado requerido'; end if;
  update public.shopping_items set purchased=p_purchased where id=p_item and household_id=h returning week_start into w;
  if not found then raise exception 'El producto ya no está en la lista. Actualiza la compra.'; end if;
  return public.get_shopping_week(w);
end $$;
create function public.set_manual_shopping(p_week date,p_ingredient uuid,p_present boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock();
begin
  if p_week is null or extract(isodow from p_week)<>1 then raise exception 'La semana debe empezar en lunes'; end if;
  if p_present is null or not exists(select 1 from public.ingredients where id=p_ingredient and household_id=h) then raise exception 'Producto no disponible'; end if;
  if p_present then
    insert into public.shopping_items(household_id,week_start,ingredient_id,manual) values(h,p_week,p_ingredient,true)
    on conflict(household_id,week_start,ingredient_id) do update set manual=true;
  else
    delete from public.shopping_items where household_id=h and week_start=p_week and ingredient_id=p_ingredient and not from_menu;
    update public.shopping_items set manual=false where household_id=h and week_start=p_week and ingredient_id=p_ingredient and from_menu and manual;
  end if;
  return public.get_shopping_week(p_week);
end $$;

-- Conserva las firmas de las APIs de menú y recetas, y recalcula antes de confirmar.
alter function public.change_menu_week(date,integer,text,uuid,date,text,uuid,jsonb) rename to change_menu_week_content;
revoke all on function public.change_menu_week_content(date,integer,text,uuid,date,text,uuid,jsonb) from public,anon,authenticated;
create function public.change_menu_week(p_week date,p_revision integer,p_action text,p_entry uuid default null,p_day date default null,p_meal text default null,p_recipe uuid default null,p_choices jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.change_menu_week_content(p_week,p_revision,p_action,p_entry,p_day,p_meal,p_recipe,p_choices);
  perform public.reconcile_shopping_week(public.my_household(),p_week);
  return result;
end $$;
alter function public.copy_menu_week(date,date,integer,boolean) rename to copy_menu_week_content;
revoke all on function public.copy_menu_week_content(date,date,integer,boolean) from public,anon,authenticated;
create function public.copy_menu_week(p_source date,p_target date,p_revision integer,p_overwrite boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.copy_menu_week_content(p_source,p_target,p_revision,p_overwrite);
  perform public.reconcile_shopping_week(public.my_household(),p_target);
  return result;
end $$;
alter function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) rename to save_recipe_menu;
revoke all on function public.save_recipe_menu(uuid,integer,text,text,text,text[],text,jsonb) from public,anon,authenticated;
create function public.save_recipe(p_id uuid,p_revision integer,p_name text,p_description text,p_instructions text,p_categories text[],p_photo_path text,p_lines jsonb) returns public.recipes language plpgsql security definer set search_path='' as $$
declare result public.recipes; w date;
begin
  result:=public.save_recipe_menu(p_id,p_revision,p_name,p_description,p_instructions,p_categories,p_photo_path,p_lines);
  for w in select distinct week_start from public.menu_entries where recipe_id=result.id loop
    perform public.reconcile_shopping_week(result.household_id,w);
  end loop;
  return result;
end $$;
revoke all on function public.get_shopping_week(date),public.set_shopping_purchased(uuid,boolean),public.set_manual_shopping(date,uuid,boolean),public.change_menu_week(date,integer,text,uuid,date,text,uuid,jsonb),public.copy_menu_week(date,date,integer,boolean),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) from public,anon;
grant execute on function public.get_shopping_week(date),public.set_shopping_purchased(uuid,boolean),public.set_manual_shopping(date,uuid,boolean),public.change_menu_week(date,integer,text,uuid,date,text,uuid,jsonb),public.copy_menu_week(date,date,integer,boolean),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) to authenticated;

do $$ declare r record; begin
  for r in select distinct household_id,week_start from public.menu_entries loop
    perform public.reconcile_shopping_week(r.household_id,r.week_start);
  end loop;
end $$;

-- Solo se publica un contador por casa: nunca el contenido privado ni eventos DELETE.
create table public.household_changes (
  household_id uuid primary key references public.households(id) on delete cascade,
  revision bigint not null default 0
);
alter table public.household_changes enable row level security;
create policy household_changes_read on public.household_changes for select to authenticated using(household_id=public.my_household());
revoke all on public.household_changes from anon,authenticated;
grant select on public.household_changes to authenticated;
insert into public.household_changes(household_id) select id from public.households;
create function public.signal_household_change() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
  if tg_table_name='households' then
    if tg_op='DELETE' then h:=old.id; else h:=new.id; end if;
  else
    if tg_op='DELETE' then h:=old.household_id; else h:=new.household_id; end if;
  end if;
  if exists(select 1 from public.households where id=h) then
    insert into public.household_changes(household_id,revision) values(h,1)
    on conflict(household_id) do update set revision=public.household_changes.revision+1;
  end if;
  return null;
end $$;
revoke all on function public.signal_household_change() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['households','household_members','household_invitations','ingredients','recipes','recipe_ingredients','recipe_alternatives','menu_weeks','menu_entries','menu_choices','shopping_items'] loop
    execute format('create trigger signal_change after insert or update or delete on public.%I for each row execute function public.signal_household_change()',t);
  end loop;
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='household_changes') then
    alter publication supabase_realtime add table public.household_changes;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
