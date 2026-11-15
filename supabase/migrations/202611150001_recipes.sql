begin;

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  kcal_per_100g numeric check (kcal_per_100g >= 0 and kcal_per_100g < 'Infinity'::numeric),
  unique (id, household_id)
);
create unique index ingredient_name_per_house on public.ingredients(household_id, lower(btrim(name)));
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  instructions text not null check (length(btrim(instructions)) between 1 and 20000),
  categories text[] not null check (cardinality(categories) between 1 and 3 and categories <@ array['breakfast','lunch','dinner']::text[] and array_position(categories,null) is null),
  photo_path text,
  archived boolean not null default false,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  household_id uuid not null,
  ingredient_id uuid not null,
  position integer not null check (position >= 0),
  foreign key(recipe_id,household_id) references public.recipes(id,household_id) on delete cascade,
  foreign key(ingredient_id,household_id) references public.ingredients(id,household_id),
  unique(recipe_id,ingredient_id),
  unique(id,household_id)
);
create table public.recipe_alternatives (
  line_id uuid not null,
  household_id uuid not null,
  ingredient_id uuid not null,
  primary key(line_id,ingredient_id),
  foreign key(line_id,household_id) references public.recipe_ingredients(id,household_id) on delete cascade,
  foreign key(ingredient_id,household_id) references public.ingredients(id,household_id)
);
create index recipes_house on public.recipes(household_id);
create index recipe_lines_recipe on public.recipe_ingredients(recipe_id);

alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_alternatives enable row level security;
create policy ingredients_read on public.ingredients for select to authenticated using(household_id=public.my_household());
create policy recipes_read on public.recipes for select to authenticated using(household_id=public.my_household());
create policy recipe_lines_read on public.recipe_ingredients for select to authenticated using(household_id=public.my_household());
create policy recipe_alternatives_read on public.recipe_alternatives for select to authenticated using(household_id=public.my_household());
revoke all on public.ingredients,public.recipes,public.recipe_ingredients,public.recipe_alternatives from anon,authenticated;
grant select on public.ingredients,public.recipes,public.recipe_ingredients,public.recipe_alternatives to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('recipe-photos','recipe-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy recipe_photos_read on storage.objects for select to authenticated using(bucket_id='recipe-photos' and (storage.foldername(name))[1]=public.my_household()::text);
create policy recipe_photos_insert on storage.objects for insert to authenticated with check(bucket_id='recipe-photos' and (storage.foldername(name))[1]=public.my_household()::text);
create policy recipe_photos_delete on storage.objects for delete to authenticated using(bucket_id='recipe-photos' and (storage.foldername(name))[1]=public.my_household()::text);

create function public.create_ingredient(p_name text,p_kcal numeric default null) returns public.ingredients
language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household(); result public.ingredients;
begin
  if h is null then raise exception 'Casa requerida'; end if;
  insert into public.ingredients(household_id,name,kcal_per_100g) values(h,btrim(p_name),p_kcal)
  on conflict(household_id,lower(btrim(name))) do update set name=public.ingredients.name
  returning * into result;
  return result;
end $$;

create function public.save_recipe(p_id uuid,p_revision integer,p_name text,p_description text,p_instructions text,p_categories text[],p_photo_path text,p_lines jsonb)
returns public.recipes language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household(); result public.recipes; item jsonb; line_id uuid; ingredient uuid; alt uuid;
begin
  if h is null then raise exception 'Casa requerida'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'Ingredientes requeridos'; end if;
  if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Entre 1 y 100 ingredientes'; end if;
  if p_photo_path is not null and (
    split_part(p_photo_path,'/',1)<>h::text or
    p_photo_path !~ '^[a-f0-9-]+/[a-f0-9-]+\.(jpg|png|webp)$' or
    not exists(select 1 from storage.objects where bucket_id='recipe-photos' and name=p_photo_path)
  ) then raise exception 'Foto no disponible'; end if;
  if p_id is null then
    insert into public.recipes(household_id,name,description,instructions,categories,photo_path)
    values(h,btrim(p_name),p_description,p_instructions,p_categories,p_photo_path) returning * into result;
  else
    update public.recipes set name=btrim(p_name),description=p_description,instructions=p_instructions,
      categories=p_categories,photo_path=p_photo_path,revision=revision+1,updated_at=now()
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
  return result;
end $$;

create function public.set_recipe_archived(p_id uuid,p_revision integer,p_archived boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.recipes set archived=p_archived,revision=revision+1,updated_at=now()
  where id=p_id and household_id=public.my_household() and revision=p_revision;
  if not found then raise exception 'El plato ha cambiado. Recarga la carta.'; end if;
end $$;
revoke all on function public.create_ingredient(text,numeric),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb),public.set_recipe_archived(uuid,integer,boolean) from public,anon;
grant execute on function public.create_ingredient(text,numeric),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb),public.set_recipe_archived(uuid,integer,boolean) to authenticated;
commit;
