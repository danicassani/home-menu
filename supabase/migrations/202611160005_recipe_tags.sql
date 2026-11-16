begin;
-- Freeze writes while migrating recipes, planning and the derived shopping list together.
lock table public.households,public.household_members,public.recipes,public.menu_weeks,public.menu_entries,public.menu_choices,public.shopping_items in access exclusive mode;

-- Existing recipes survive, without converting fixed meal categories into user labels.
alter table public.recipes drop constraint recipes_categories_check;
alter table public.recipes rename column categories to tags;
update public.recipes set tags='{}',revision=revision+1,updated_at=now();
alter table public.recipes alter column tags set default '{}';
create function public.valid_recipe_tags(p_tags text[]) returns boolean language sql immutable set search_path='' as $$
 select p_tags is not null and coalesce(array_ndims(p_tags),1)=1 and cardinality(p_tags)<=20
 and not exists(select 1 from unnest(p_tags) tag where tag is null or char_length(tag) not between 1 and 40 or tag<>normalize(btrim(regexp_replace(tag,'[[:space:] ]+',' ','g')),NFC))
 and cardinality(p_tags)=(select count(distinct lower(tag)) from unnest(p_tags) tag)
$$;
revoke all on function public.valid_recipe_tags(text[]) from public,anon,authenticated;
alter table public.recipes add constraint recipes_tags_check check(public.valid_recipe_tags(tags));

-- Remove only breakfast plans and reconcile each affected week; manual products remain.
do $$ declare affected record; begin
 for affected in select distinct household_id,week_start from public.menu_entries where meal='breakfast' loop
  delete from public.menu_entries where household_id=affected.household_id and week_start=affected.week_start and meal='breakfast';
  update public.menu_weeks set revision=revision+1 where household_id=affected.household_id and week_start=affected.week_start;
  perform public.reconcile_shopping_week(affected.household_id,affected.week_start);
 end loop;
end $$;
alter table public.menu_entries drop constraint menu_entries_meal_check;
alter table public.menu_entries add constraint menu_entries_meal_check check(meal in ('lunch','dinner'));

-- Replace the old recipe wrappers; preserve revisions, authorization, choices and reconciliation.
drop function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb);
drop function public.save_recipe_menu(uuid,integer,text,text,text,text[],text,jsonb);
drop function public.save_recipe_content(uuid,integer,text,text,text,text[],text,jsonb);
create function public.save_recipe(p_id uuid,p_revision integer,p_name text,p_description text,p_instructions text,p_tags text[],p_photo_path text,p_lines jsonb)
returns public.recipes language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); result public.recipes; item jsonb; line_id uuid; ingredient uuid; alt uuid; normalized text; clean_tags text[]:='{}'; changed_entries uuid[]; w date;
begin
  if p_tags is null or coalesce(array_ndims(p_tags),1)<>1 or cardinality(p_tags)>20 then raise exception 'Máximo 20 etiquetas'; end if;
  foreach normalized in array p_tags loop
    if normalized is null then raise exception 'Etiqueta inválida'; end if;
    normalized:=normalize(btrim(regexp_replace(normalized,'[[:space:] ]+',' ','g')),NFC);
    if char_length(normalized) not between 1 and 40 then raise exception 'Etiquetas de 1 a 40 caracteres'; end if;
    if not exists(select 1 from unnest(clean_tags) tag where lower(tag)=lower(normalized)) then clean_tags:=array_append(clean_tags,normalized); end if;
  end loop;
  p_tags:=clean_tags;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Ingredientes requeridos'; end if;
  if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Entre 1 y 100 ingredientes'; end if;
  if p_photo_path is not null and (
    split_part(p_photo_path,'/',1)<>h::text or
    p_photo_path !~ '^[a-f0-9-]+/[a-f0-9-]+\.(jpg|png|webp)$' or
    not exists(select 1 from storage.objects where bucket_id='recipe-photos' and name=p_photo_path)
  ) then raise exception 'Foto no disponible'; end if;
  if p_id is null then
    insert into public.recipes(household_id,name,description,instructions,tags,photo_path)
    values(h,btrim(p_name),p_description,p_instructions,p_tags,p_photo_path) returning * into result;
  else
    update public.recipes set name=btrim(p_name),description=p_description,instructions=p_instructions,
      tags=p_tags,photo_path=p_photo_path,revision=revision+1,updated_at=now()
    where id=p_id and household_id=h and revision=p_revision and not archived returning * into result;
    if not found then raise exception 'El plato ha cambiado. Recarga la carta.'; end if;
    delete from public.recipe_ingredients where recipe_id=p_id;
  end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    ingredient:=(item->>'ingredient_id')::uuid;
    line_id:=coalesce((item->>'id')::uuid,gen_random_uuid());
    insert into public.recipe_ingredients(id,recipe_id,household_id,ingredient_id,position)
    values(line_id,result.id,h,ingredient,(select count(*) from public.recipe_ingredients where recipe_id=result.id));
    if jsonb_typeof(item->'alternatives') is distinct from 'array' then raise exception 'Alternativas inválidas'; end if;
    for alt in select value::text::uuid from jsonb_array_elements_text(item->'alternatives') loop
      if alt=ingredient then raise exception 'Alternativa repetida'; end if;
      insert into public.recipe_alternatives(line_id,household_id,ingredient_id) values(line_id,h,alt);
    end loop;
  end loop;
  with removed as (
    delete from public.menu_choices c using public.menu_entries e
    where c.entry_id=e.id and e.recipe_id=result.id and not exists(
      select 1 from public.recipe_ingredients l join public.recipe_alternatives a on a.line_id=l.id
      where l.recipe_id=result.id and l.ingredient_id=c.ingredient_id and a.ingredient_id=c.alternative_id
    ) returning c.entry_id
  ) select array_agg(distinct entry_id) into changed_entries from removed;
  update public.menu_entries set choices_reset=true where id=any(changed_entries);
  update public.menu_weeks mw set revision=revision+1 where mw.household_id=h and exists(
    select 1 from public.menu_entries e where e.household_id=h and e.week_start=mw.week_start and e.recipe_id=result.id
  );
  for w in select distinct week_start from public.menu_entries where recipe_id=result.id loop
    perform public.reconcile_shopping_week(h,w);
  end loop;
  return result;
end $$;

revoke all on function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) from public,anon;
grant execute on function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
