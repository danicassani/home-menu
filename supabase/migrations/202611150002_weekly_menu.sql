begin;

create table public.menu_weeks (
  household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start)=1),
  revision integer not null default 0 check (revision>=0),
  primary key(household_id,week_start)
);
create table public.menu_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  week_start date not null,
  planned_day date not null check (planned_day>=week_start and planned_day<week_start+7),
  meal text not null check (meal in ('breakfast','lunch','dinner')),
  recipe_id uuid not null,
  sort_order bigint generated always as identity,
  choices_reset boolean not null default false,
  foreign key(household_id,week_start) references public.menu_weeks on delete cascade,
  foreign key(recipe_id,household_id) references public.recipes(id,household_id),
  unique(id,household_id)
);
create index menu_entries_week on public.menu_entries(household_id,week_start);
create index menu_entries_recipe on public.menu_entries(recipe_id);
create table public.menu_choices (
  entry_id uuid not null,
  household_id uuid not null,
  ingredient_id uuid not null,
  alternative_id uuid not null,
  primary key(entry_id,ingredient_id),
  foreign key(entry_id,household_id) references public.menu_entries(id,household_id) on delete cascade,
  foreign key(ingredient_id,household_id) references public.ingredients(id,household_id),
  foreign key(alternative_id,household_id) references public.ingredients(id,household_id)
);
alter table public.menu_weeks enable row level security;
alter table public.menu_entries enable row level security;
alter table public.menu_choices enable row level security;
create policy menu_weeks_read on public.menu_weeks for select to authenticated using(household_id=public.my_household());
create policy menu_entries_read on public.menu_entries for select to authenticated using(household_id=public.my_household());
create policy menu_choices_read on public.menu_choices for select to authenticated using(household_id=public.my_household());
revoke all on public.menu_weeks,public.menu_entries,public.menu_choices from anon,authenticated;
grant select on public.menu_weeks,public.menu_entries,public.menu_choices to authenticated;

-- Serializa escrituras del menú y del contenido de recetas dentro de cada casa.
create function public.menu_house_lock() returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household();
begin
  if h is null then raise exception 'Casa requerida'; end if;
  perform pg_advisory_xact_lock(hashtextextended(h::text,0));
  return h;
end $$;
revoke all on function public.menu_house_lock() from public,anon,authenticated;

create function public.get_menu_week(p_week date) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household(); result jsonb;
begin
  if h is null then raise exception 'Casa requerida'; end if;
  if p_week is null or extract(isodow from p_week)<>1 then raise exception 'La semana debe empezar en lunes'; end if;
  select jsonb_build_object(
    'revision',coalesce((select revision from public.menu_weeks where household_id=h and week_start=p_week),0),
    'entries',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'planned_day',e.planned_day,'meal',e.meal,'recipe_id',e.recipe_id,'choices_reset',e.choices_reset,
      'choices',coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',c.ingredient_id,'alternative_id',c.alternative_id) order by c.ingredient_id) from public.menu_choices c where c.entry_id=e.id),'[]'::jsonb)
    ) order by e.sort_order) from public.menu_entries e where e.household_id=h and e.week_start=p_week),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.change_menu_week(p_week date,p_revision integer,p_action text,p_entry uuid default null,p_day date default null,p_meal text default null,p_recipe uuid default null,p_choices jsonb default '[]')
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); e public.menu_entries; choice jsonb; original_id uuid; alt_id uuid; current_revision integer;
begin
  if p_week is null or extract(isodow from p_week)<>1 then raise exception 'La semana debe empezar en lunes'; end if;
  if p_action is null or p_action not in ('add','replace','remove','choices','ack') then raise exception 'Acción inválida'; end if;
  insert into public.menu_weeks(household_id,week_start) values(h,p_week) on conflict do nothing;
  select revision into current_revision from public.menu_weeks where household_id=h and week_start=p_week;
  if current_revision is distinct from p_revision then raise exception 'El menú ha cambiado. Actualiza la semana.'; end if;
  if p_action<>'add' then
    select * into e from public.menu_entries where id=p_entry and household_id=h and week_start=p_week;
    if not found then raise exception 'Plato no disponible'; end if;
  end if;
  if p_action in ('add','replace') then
    if not exists(select 1 from public.recipes where id=p_recipe and household_id=h and not archived) then raise exception 'Plato no disponible'; end if;
    if p_action='add' then
      insert into public.menu_entries(household_id,week_start,planned_day,meal,recipe_id) values(h,p_week,p_day,p_meal,p_recipe);
    else
      delete from public.menu_choices where entry_id=e.id;
      update public.menu_entries set recipe_id=p_recipe,choices_reset=false where id=e.id;
    end if;
  elsif p_action='remove' then
    delete from public.menu_entries where id=e.id;
  elsif p_action='ack' then
    update public.menu_entries set choices_reset=false where id=e.id;
  elsif p_action='choices' then
    if jsonb_typeof(p_choices) is distinct from 'array' then raise exception 'Alternativas inválidas'; end if;
    delete from public.menu_choices where entry_id=e.id;
    for choice in select value from jsonb_array_elements(p_choices) loop
      original_id:=(choice->>'ingredient_id')::uuid;
      alt_id:=(choice->>'alternative_id')::uuid;
      if not exists(select 1 from public.recipe_ingredients l join public.recipe_alternatives a on a.line_id=l.id
        where l.recipe_id=e.recipe_id and l.ingredient_id=original_id and a.ingredient_id=alt_id) then raise exception 'Alternativa no disponible'; end if;
      insert into public.menu_choices(entry_id,household_id,ingredient_id,alternative_id) values(e.id,h,original_id,alt_id);
    end loop;
    update public.menu_entries set choices_reset=false where id=e.id;
  end if;
  update public.menu_weeks set revision=revision+1 where household_id=h and week_start=p_week;
  return public.get_menu_week(p_week);
end $$;

create function public.copy_menu_week(p_source date,p_target date,p_revision integer,p_overwrite boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); e public.menu_entries; new_id uuid; current_revision integer;
begin
  if p_source is null or p_target is null or extract(isodow from p_source)<>1 or extract(isodow from p_target)<>1 or p_source=p_target then raise exception 'Semanas inválidas'; end if;
  if not exists(select 1 from public.menu_entries where household_id=h and week_start=p_source) then raise exception 'La semana de origen está vacía'; end if;
  insert into public.menu_weeks(household_id,week_start) values(h,p_target) on conflict do nothing;
  select revision into current_revision from public.menu_weeks where household_id=h and week_start=p_target;
  if current_revision is distinct from p_revision then raise exception 'El menú ha cambiado. Actualiza la semana.'; end if;
  if exists(select 1 from public.menu_entries where household_id=h and week_start=p_target) and p_overwrite is distinct from true then raise exception 'Confirma la sustitución de la semana'; end if;
  delete from public.menu_entries where household_id=h and week_start=p_target;
  for e in select * from public.menu_entries where household_id=h and week_start=p_source order by sort_order loop
    insert into public.menu_entries(household_id,week_start,planned_day,meal,recipe_id,choices_reset)
    values(h,p_target,p_target+(e.planned_day-p_source),e.meal,e.recipe_id,e.choices_reset) returning id into new_id;
    insert into public.menu_choices(entry_id,household_id,ingredient_id,alternative_id)
    select new_id,h,ingredient_id,alternative_id from public.menu_choices where entry_id=e.id;
  end loop;
  update public.menu_weeks set revision=revision+1 where household_id=h and week_start=p_target;
  return public.get_menu_week(p_target);
end $$;

-- La receta mantiene su contrato público. La implementación anterior queda privada.
alter function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) rename to save_recipe_content;
revoke all on function public.save_recipe_content(uuid,integer,text,text,text,text[],text,jsonb) from public,anon,authenticated;
create function public.save_recipe(p_id uuid,p_revision integer,p_name text,p_description text,p_instructions text,p_categories text[],p_photo_path text,p_lines jsonb)
returns public.recipes language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); result public.recipes; changed_entries uuid[];
begin
  result:=public.save_recipe_content(p_id,p_revision,p_name,p_description,p_instructions,p_categories,p_photo_path,p_lines);
  with removed as (
    delete from public.menu_choices c using public.menu_entries e
    where c.entry_id=e.id and e.recipe_id=result.id and not exists(
      select 1 from public.recipe_ingredients l join public.recipe_alternatives a on a.line_id=l.id
      where l.recipe_id=result.id and l.ingredient_id=c.ingredient_id and a.ingredient_id=c.alternative_id
    ) returning c.entry_id
  ) select array_agg(distinct entry_id) into changed_entries from removed;
  update public.menu_entries set choices_reset=true where id=any(changed_entries);
  update public.menu_weeks w set revision=revision+1 where w.household_id=h and exists(
    select 1 from public.menu_entries e where e.household_id=h and e.week_start=w.week_start and e.recipe_id=result.id
  );
  return result;
end $$;
revoke all on function public.get_menu_week(date),public.change_menu_week(date,integer,text,uuid,date,text,uuid,jsonb),public.copy_menu_week(date,date,integer,boolean),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) from public,anon;
grant execute on function public.get_menu_week(date),public.change_menu_week(date,integer,text,uuid,date,text,uuid,jsonb),public.copy_menu_week(date,date,integer,boolean),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) to authenticated;
commit;
