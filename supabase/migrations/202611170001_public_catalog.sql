begin;
-- Public catalog is authenticated-only. Private projections keep recipe/ingredient IDs stable.
-- Revalidate membership after waiting for a concurrent house operation.
create or replace function public.menu_house_lock() returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household();begin
 if h is null then raise exception 'Casa requerida';end if;
 perform pg_advisory_xact_lock(hashtextextended(h::text,0));
 if h is distinct from public.my_household() then raise exception 'Casa no disponible';end if;
 return h;
end $$;
create table public.catalog_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.catalog_admins enable row level security;
create function public.is_catalog_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.catalog_admins where user_id=auth.uid())$$;
create table public.public_ingredients(
 id uuid primary key default gen_random_uuid(),name text not null check(char_length(btrim(name)) between 1 and 120),
 kcal_per_100g numeric check(kcal_per_100g>=0 and kcal_per_100g<'Infinity'::numeric),revision integer not null default 1
);
create unique index public_ingredient_name on public.public_ingredients(lower(btrim(name)));
alter table public.ingredients add column revision integer not null default 1;
create table public.public_recipes(
 id uuid primary key default gen_random_uuid(),author_household_id uuid references public.households(id) on delete set null,
 source_recipe_id uuid unique references public.recipes(id) on delete set null,
 name text not null,description text not null,instructions text not null,tags text[] not null,
 photo_path text,active boolean not null default true,revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.public_recipe_lines(
 id uuid primary key default gen_random_uuid(),publication_id uuid not null references public.public_recipes(id) on delete cascade,
 ingredient_id uuid not null references public.public_ingredients(id),position integer not null,
 alternatives uuid[] not null default '{}',unique(publication_id,ingredient_id)
);
create table public.catalog_ingredient_links(
 household_id uuid not null references public.households(id) on delete cascade,
 public_ingredient_id uuid not null references public.public_ingredients(id),ingredient_id uuid not null,
 managed boolean not null default false,primary key(household_id,public_ingredient_id),
 foreign key(ingredient_id,household_id) references public.ingredients(id,household_id) on delete cascade
);
alter table public.recipes add column publication_id uuid references public.public_recipes(id),add column catalog_imported boolean not null default false,add column catalog_photo_path text;
create table public.catalog_incorporations(
 household_id uuid not null references public.households(id) on delete cascade,
 publication_id uuid not null references public.public_recipes(id),recipe_id uuid not null unique,
 active boolean not null default true,primary key(household_id,publication_id),
 foreign key(recipe_id,household_id) references public.recipes(id,household_id) on delete cascade
);
create table public.catalog_photo_gc(name text primary key);
alter table public.catalog_photo_gc enable row level security;
revoke all on public.catalog_photo_gc from public,anon,authenticated;
create table public.catalog_changes(id boolean primary key default true check(id),revision bigint not null default 0);
insert into public.catalog_changes values(true,0);
alter table public.public_ingredients enable row level security;
alter table public.public_recipes enable row level security;
alter table public.public_recipe_lines enable row level security;
alter table public.catalog_ingredient_links enable row level security;
alter table public.catalog_incorporations enable row level security;
alter table public.catalog_changes enable row level security;
-- Only curated RPC results expose publications, never the publishing house's identifiers.
grant select on public.public_ingredients,public.catalog_changes to authenticated;
create policy public_ingredients_read on public.public_ingredients for select to authenticated using(true);
create policy catalog_changes_read on public.catalog_changes for select to authenticated using(true);
revoke all on public.public_recipes,public.public_recipe_lines,public.catalog_admins,public.catalog_ingredient_links,public.catalog_incorporations from anon,authenticated;
create function public.catalog_lock() returns void language sql security definer set search_path='' as $$select pg_advisory_xact_lock(hashtextextended('home-menu-public-catalog',0))$$;
create function public.catalog_signal() returns void language sql security definer set search_path='' as $$update public.catalog_changes set revision=revision+1 where id$$;
create function public.catalog_local_ingredient(p_house uuid,p_public uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; item public.public_ingredients; created boolean:=false;
begin
 select ingredient_id into result from public.catalog_ingredient_links where household_id=p_house and public_ingredient_id=p_public;
 if result is not null then return result; end if;
 select * into strict item from public.public_ingredients where id=p_public;
 select id into result from public.ingredients where household_id=p_house and lower(btrim(name))=lower(btrim(item.name));
 if result is null then
  insert into public.ingredients(household_id,name,kcal_per_100g) values(p_house,item.name,item.kcal_per_100g) returning id into result;created:=true;
 end if;
 insert into public.catalog_ingredient_links values(p_house,p_public,result,created);
 return result;
end $$;
create function public.catalog_global_ingredient(p_house uuid,p_local uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; item public.ingredients;
begin
 select public_ingredient_id into result from public.catalog_ingredient_links where household_id=p_house and ingredient_id=p_local order by public_ingredient_id limit 1;
 if result is not null then return result; end if;
 select * into strict item from public.ingredients where id=p_local and household_id=p_house;
 insert into public.public_ingredients(name,kcal_per_100g) values(normalize(btrim(regexp_replace(item.name,'[[:space:] ]+',' ','g')),NFC),item.kcal_per_100g)
 on conflict(lower(btrim(name))) do update set name=public.public_ingredients.name returning id into result;
 insert into public.catalog_ingredient_links values(p_house,result,p_local,false) on conflict do nothing;
 return result;
end $$;
create function public.catalog_refresh_menu(p_recipe uuid,p_house uuid) returns void language plpgsql security definer set search_path='' as $$
declare changed uuid[]; w date;
begin
 with removed as (
 delete from public.menu_choices c using public.menu_entries e where c.entry_id=e.id and e.recipe_id=p_recipe and not exists(
 select 1 from public.recipe_ingredients l join public.recipe_alternatives a on a.line_id=l.id
 where l.recipe_id=p_recipe and l.ingredient_id=c.ingredient_id and a.ingredient_id=c.alternative_id) returning c.entry_id
 ) select array_agg(distinct entry_id) into changed from removed;
 update public.menu_entries set choices_reset=true where id=any(changed);
 update public.menu_weeks mw set revision=revision+1 where mw.household_id=p_house and exists(select 1 from public.menu_entries e where e.recipe_id=p_recipe and e.week_start=mw.week_start);
 for w in select distinct week_start from public.menu_entries where recipe_id=p_recipe loop perform public.reconcile_shopping_week(p_house,w);end loop;
end $$;
create function public.catalog_project(p_public uuid,p_house uuid,p_recipe uuid) returns void language plpgsql security definer set search_path='' as $$
declare item public.public_recipes;l record;line_id uuid;local_id uuid;alt uuid;
begin
 select * into strict item from public.public_recipes where id=p_public and active;
 update public.recipes set name=item.name,description=item.description,instructions=item.instructions,tags=item.tags,
 photo_path=null,catalog_photo_path=item.photo_path,publication_id=item.id,catalog_imported=true,revision=revision+1,updated_at=now() where id=p_recipe and household_id=p_house;
 delete from public.recipe_ingredients where recipe_id=p_recipe;
 for l in select * from public.public_recipe_lines where publication_id=p_public order by position loop
  local_id:=public.catalog_local_ingredient(p_house,l.ingredient_id);
  insert into public.recipe_ingredients(recipe_id,household_id,ingredient_id,position) values(p_recipe,p_house,local_id,l.position) on conflict(recipe_id,ingredient_id) do update set position=least(public.recipe_ingredients.position,excluded.position) returning id into line_id;
  foreach alt in array l.alternatives loop
   if public.catalog_local_ingredient(p_house,alt)<>local_id then insert into public.recipe_alternatives(line_id,household_id,ingredient_id) values(line_id,p_house,public.catalog_local_ingredient(p_house,alt)) on conflict do nothing;end if;
  end loop;
 end loop;
 perform public.catalog_refresh_menu(p_recipe,p_house);
end $$;
create function public.catalog_sync(p_recipe uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare source public.recipes;pub uuid;l record;pi uuid;alts uuid[];a uuid;inc record;
begin
 select * into strict source from public.recipes where id=p_recipe;
 select id into pub from public.public_recipes where source_recipe_id=p_recipe and active;
 if pub is null then raise exception 'Publicación no disponible';end if;
 if source.photo_path is not null and (not exists(select 1 from storage.objects where bucket_id='catalog-photos' and name=source.photo_path) or exists(select 1 from public.catalog_photo_gc where name=source.photo_path)) then raise exception 'Prepara la foto antes de publicar';end if;
 update public.public_recipes set name=source.name,description=source.description,instructions=source.instructions,tags=source.tags,
 photo_path=coalesce(source.photo_path,source.catalog_photo_path),revision=revision+1,updated_at=now() where id=pub;
 delete from public.public_recipe_lines where publication_id=pub;
 for l in select * from public.recipe_ingredients where recipe_id=p_recipe order by position loop
  pi:=public.catalog_global_ingredient(source.household_id,l.ingredient_id);alts:='{}';
  for a in select ingredient_id from public.recipe_alternatives where line_id=l.id loop
   alts:=array_append(alts,public.catalog_global_ingredient(source.household_id,a));
  end loop;
  insert into public.public_recipe_lines(publication_id,ingredient_id,position,alternatives) values(pub,pi,l.position,alts);
 end loop;
 for inc in select * from public.catalog_incorporations where publication_id=pub and active order by household_id loop
  perform pg_advisory_xact_lock(hashtextextended(inc.household_id::text,0));
  perform public.catalog_project(pub,inc.household_id,inc.recipe_id);
 end loop;
 perform public.catalog_signal();return pub;
end $$;
-- The original validated save remains internal, including its recipe/menu/shopping transaction.
alter function public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb) rename to save_recipe_private;
revoke all on function public.save_recipe_private(uuid,integer,text,text,text,text[],text,jsonb) from public,anon,authenticated;
create function public.save_recipe(p_id uuid,p_revision integer,p_name text,p_description text,p_instructions text,p_tags text[],p_photo_path text,p_lines jsonb,p_clear_photo boolean default false)
returns public.recipes language plpgsql security definer set search_path='' as $$
declare result public.recipes;h uuid;snapshot text;
begin
 perform public.catalog_lock();h:=public.menu_house_lock();
 if exists(select 1 from public.recipes where id=p_id and household_id=h and catalog_imported) then raise exception 'La receta pública solo puede editarla su casa autora';end if;
 select catalog_photo_path into snapshot from public.recipes where id=p_id and household_id=h;
 result:=public.save_recipe_private(p_id,p_revision,p_name,p_description,p_instructions,p_tags,p_photo_path,p_lines);
 update public.recipes set catalog_photo_path=case when p_clear_photo or p_photo_path is not null then null else snapshot end where id=result.id returning * into result;
 if exists(select 1 from public.public_recipes where source_recipe_id=result.id and active) then perform public.catalog_sync(result.id);end if;
 return result;
end $$;
create function public.publish_recipe(p_recipe uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;source public.recipes;pub uuid;
begin
 perform public.catalog_lock();h:=public.menu_house_lock();
 select * into source from public.recipes where id=p_recipe and household_id=h and revision=p_revision and not archived and not catalog_imported;
 if not found then raise exception 'El plato ha cambiado o no pertenece a tu casa';end if;
 select id into pub from public.public_recipes where source_recipe_id=p_recipe;
 if pub is null then
  insert into public.public_recipes(author_household_id,source_recipe_id,name,description,instructions,tags) values(h,p_recipe,source.name,source.description,source.instructions,source.tags) returning id into pub;
 else update public.public_recipes set active=true where id=pub;end if;
 update public.recipes set publication_id=pub,revision=revision+1 where id=p_recipe;
 return public.catalog_sync(p_recipe);
end $$;
create function public.incorporate_public_recipe(p_public uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;item public.public_recipes;result uuid;already boolean;
begin
 perform public.catalog_lock();h:=public.menu_house_lock();
 select * into item from public.public_recipes where id=p_public and active;
 if not found then raise exception 'Publicación no disponible';end if;
 if item.author_household_id=h then
  update public.recipes set archived=false,revision=revision+1 where id=item.source_recipe_id and archived;
  return item.source_recipe_id;
 end if;
 select recipe_id,active into result,already from public.catalog_incorporations where household_id=h and publication_id=p_public;
 if result is not null and already then return result;end if;
 if result is null then
  insert into public.recipes(household_id,name,description,instructions,tags) values(h,item.name,item.description,item.instructions,item.tags) returning id into result;
  insert into public.catalog_incorporations values(h,p_public,result,true);
 else update public.catalog_incorporations set active=true where household_id=h and publication_id=p_public;
 end if;
 update public.recipes set archived=false where id=result;
 perform public.catalog_project(p_public,h,result);return result;
end $$;
alter function public.set_recipe_archived(uuid,integer,boolean) rename to set_recipe_archived_private;
revoke all on function public.set_recipe_archived_private(uuid,integer,boolean) from public,anon,authenticated;
create function public.set_recipe_archived(p_id uuid,p_revision integer,p_archived boolean) returns void language plpgsql security definer set search_path='' as $$
declare h uuid;pub uuid;
begin
 perform public.catalog_lock();h:=public.menu_house_lock();
 select publication_id into pub from public.recipes where id=p_id and household_id=h and revision=p_revision;
 if not found then raise exception 'El plato ha cambiado';end if;
 perform public.set_recipe_archived_private(p_id,p_revision,p_archived);
 update public.catalog_incorporations set active=not p_archived where recipe_id=p_id and household_id=h;
 if p_archived then perform public.catalog_detach_ingredients(h);end if;
 if not p_archived and exists(select 1 from public.public_recipes where id=pub and active and author_household_id<>h) then perform public.catalog_project(pub,h,p_id);end if;
end $$;
create function public.catalog_detach_ingredients(p_house uuid) returns void language sql security definer set search_path='' as $$
 update public.catalog_ingredient_links link set managed=false where household_id=p_house and managed and not exists(
 select 1 from public.catalog_incorporations inc join public.public_recipe_lines line on line.publication_id=inc.publication_id
 where inc.household_id=p_house and inc.active and (line.ingredient_id=link.public_ingredient_id or link.public_ingredient_id=any(line.alternatives)))
$$;
create function public.catalog_withdraw(p_public uuid) returns void language plpgsql security definer set search_path='' as $$
declare houses uuid[];h uuid;
begin
 select array_agg(distinct household_id) into houses from public.catalog_incorporations where publication_id=p_public;
 update public.recipes set publication_id=null,catalog_imported=false,revision=revision+1 where publication_id=p_public;
 delete from public.catalog_incorporations where publication_id=p_public;
 foreach h in array coalesce(houses,'{}'::uuid[]) loop perform public.catalog_detach_ingredients(h);end loop;
 update public.public_recipes set active=false,revision=revision+1,updated_at=now() where id=p_public;
 perform public.catalog_signal();
end $$;
create function public.unpublish_recipe(p_public uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 perform public.catalog_lock();h:=public.menu_house_lock();
 if not exists(select 1 from public.public_recipes where id=p_public and author_household_id=h and revision=p_revision and active) then raise exception 'La publicación ha cambiado o no pertenece a tu casa';end if;
 perform public.catalog_withdraw(p_public);
end $$;
-- Freeze imported snapshots before any source photos or recipe rows can be deleted.
create function public.catalog_house_deletion() returns trigger language plpgsql security definer set search_path='' as $$
declare pub uuid;
begin
 if new.deletion_requested_at is not null and old.deletion_requested_at is null then
  for pub in select id from public.public_recipes where author_household_id=new.id and active loop perform public.catalog_withdraw(pub);end loop;
 end if;return new;
end $$;
create trigger catalog_house_deletion before update of deletion_requested_at on public.households for each row execute function public.catalog_house_deletion();
alter function public.begin_household_deletion(uuid,text) rename to begin_household_deletion_private;
revoke all on function public.begin_household_deletion_private(uuid,text) from public,anon,authenticated;
create function public.begin_household_deletion(p_house uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$begin perform public.catalog_lock();perform public.begin_household_deletion_private(p_house,p_confirmation);end $$;
alter function public.finish_household_deletion(uuid) rename to finish_household_deletion_private;
revoke all on function public.finish_household_deletion_private(uuid) from public,anon,authenticated;
create function public.finish_household_deletion(p_house uuid) returns void language plpgsql security definer set search_path='' as $$begin perform public.catalog_lock();perform public.finish_household_deletion_private(p_house);end $$;
create function public.update_ingredient(p_id uuid,p_revision integer,p_name text,p_kcal numeric,p_public boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare h uuid;link record;normalized text:=normalize(btrim(regexp_replace(p_name,'[[:space:] ]+',' ','g')),NFC);
begin
 perform public.catalog_lock();
 if normalized is null or char_length(normalized) not between 1 and 120 or p_kcal<0 or p_kcal>='Infinity'::numeric then raise exception 'Ingrediente inválido';end if;
 if p_public then
  if not public.is_catalog_admin() then raise exception 'Solo administradores';end if;
  update public.public_ingredients set name=normalized,kcal_per_100g=p_kcal,revision=revision+1 where id=p_id and revision=p_revision;
  if not found then raise exception 'El ingrediente ha cambiado';end if;
  for link in select * from public.catalog_ingredient_links where public_ingredient_id=p_id and managed order by household_id loop
   perform pg_advisory_xact_lock(hashtextextended(link.household_id::text,0));
   if exists(select 1 from public.ingredients where household_id=link.household_id and id<>link.ingredient_id and lower(btrim(name))=lower(normalized)) then
    update public.catalog_ingredient_links set managed=false where household_id=link.household_id and public_ingredient_id=p_id;
   else update public.ingredients set name=normalized,kcal_per_100g=p_kcal,revision=revision+1 where id=link.ingredient_id;end if;
  end loop;
  perform public.catalog_signal();
 else
  h:=public.menu_house_lock();
  update public.ingredients set name=normalized,kcal_per_100g=p_kcal,revision=revision+1 where id=p_id and household_id=h and revision=p_revision;
  if not found then raise exception 'El ingrediente ha cambiado o no pertenece a tu casa';end if;
  update public.catalog_ingredient_links set managed=false where household_id=h and ingredient_id=p_id;
 end if;
end $$;
create function public.get_public_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then null else coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'name',p.name,'description',p.description,'instructions',p.instructions,'tags',p.tags,'photo_path',p.photo_path,'revision',p.revision,
 'owned',p.author_household_id=public.my_household(),'local_recipe_id',r.id,'incorporated',coalesce(not r.archived,false),
 'lines',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'ingredient_id',l.ingredient_id,'alternatives',l.alternatives) order by l.position) from public.public_recipe_lines l where l.publication_id=p.id),'[]'::jsonb)
 ) order by p.name),'[]'::jsonb) end from public.public_recipes p
 left join public.recipes r on r.publication_id=p.id and r.household_id=public.my_household() where p.active
$$;
-- Immutable photo assets stay private: catalog readers see active publications; withdrawn assets
-- remain accessible only through an authorized household snapshot. Source deletion cannot break them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('catalog-photos','catalog-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create function public.can_read_catalog_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.public_recipes where active and photo_path=p_path)
 or exists(select 1 from public.recipes where household_id=public.my_household() and catalog_photo_path=p_path))
$$;
create policy catalog_photo_read on storage.objects for select to authenticated using(bucket_id='catalog-photos' and public.can_read_catalog_photo(name));
alter publication supabase_realtime add table public.catalog_changes;
-- Helpers are never callable by browsers. Only the following entry points are granted.
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and (proname like 'catalog_%' or proname in ('is_catalog_admin','can_read_catalog_photo','save_recipe','publish_recipe','incorporate_public_recipe','set_recipe_archived','unpublish_recipe','update_ingredient','get_public_catalog','begin_household_deletion','finish_household_deletion')) loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.is_catalog_admin(),public.can_read_catalog_photo(text),public.get_public_catalog(),public.publish_recipe(uuid,integer),public.incorporate_public_recipe(uuid),public.unpublish_recipe(uuid,integer),public.update_ingredient(uuid,integer,text,numeric,boolean),public.set_recipe_archived(uuid,integer,boolean),public.save_recipe(uuid,integer,text,text,text,text[],text,jsonb,boolean),public.begin_household_deletion(uuid,text),public.finish_household_deletion(uuid) to authenticated;
-- Storage deletion is performed by the Edge Function, never by SQL.
create function public.catalog_unused_photos() returns table(name text) language plpgsql security definer set search_path='' as $$
begin
 perform public.catalog_lock();
 insert into public.catalog_photo_gc(name)
 select o.name from storage.objects o where o.bucket_id='catalog-photos' and o.created_at<now()-interval '24 hours'
 and not exists(select 1 from public.public_recipes p where p.active and p.photo_path=o.name)
 and not exists(select 1 from public.recipes r where r.catalog_photo_path=o.name)
 on conflict do nothing;
 return query select gc.name from public.catalog_photo_gc gc;
end $$;
create function public.catalog_finish_photo_gc(p_names text[]) returns void language sql security definer set search_path='' as $$delete from public.catalog_photo_gc where name=any(p_names)$$;
revoke all on function public.catalog_unused_photos(),public.catalog_finish_photo_gc(text[]) from public,anon,authenticated;
grant execute on function public.catalog_unused_photos(),public.catalog_finish_photo_gc(text[]) to service_role;
notify pgrst,'reload schema';
commit;
