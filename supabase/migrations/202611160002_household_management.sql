begin;
alter table public.households add column deletion_requested_at timestamptz;
create or replace function public.my_household() returns uuid language sql stable security definer set search_path='' as $$
  select m.household_id from public.household_members m join public.households h on h.id=m.household_id
  where m.user_id=auth.uid() and h.deletion_requested_at is null
$$;
create policy pending_house_owner_read on public.households for select to authenticated using(owner_id=auth.uid() and deletion_requested_at is not null);

-- Mantiene el mismo orden de bloqueo en todas las escrituras de una casa.
create or replace function public.create_ingredient(p_name text,p_kcal numeric default null) returns public.ingredients
language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); result public.ingredients;
begin
  if h is null then raise exception 'Casa requerida'; end if;
  insert into public.ingredients(household_id,name,kcal_per_100g) values(h,btrim(p_name),p_kcal)
  on conflict(household_id,lower(btrim(name))) do update set name=public.ingredients.name
  returning * into result;
  return result;
end $$;

create or replace function public.set_recipe_archived(p_id uuid,p_revision integer,p_archived boolean) returns void
language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock();
begin
  update public.recipes set archived=p_archived,revision=revision+1,updated_at=now()
  where id=p_id and household_id=h and revision=p_revision;
  if not found then raise exception 'El plato ha cambiado. Recarga la carta.'; end if;
end $$;

create or replace function public.create_household_invitation() returns text language plpgsql security definer set search_path = '' as $$
declare h uuid := public.menu_house_lock(); token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
 if not exists(select 1 from public.households where id=h and owner_id=auth.uid()) then raise exception 'Solo el propietario puede invitar'; end if;
 insert into public.household_invitations(household_id,token_hash) values(h,encode(sha256(convert_to(token,'UTF8')),'hex'));
 return token;
end $$;

create or replace function public.revoke_household_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock();
begin
  update public.household_invitations i set revoked_at=now() where i.id=invitation_id and i.household_id=h and exists(
    select 1 from public.households x where x.id=h and x.owner_id=auth.uid());
  if not found then raise exception 'Invitación no disponible'; end if;
end $$;

create function public.get_household_members() returns table(user_id uuid,display_name text,is_owner boolean)
language plpgsql security definer set search_path='' as $$
declare h uuid:=public.my_household();
begin
  if h is null then raise exception 'Casa requerida'; end if;
  return query select m.user_id,coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.raw_user_meta_data->>'name'),''),nullif(btrim(u.email),''),'Miembro'),m.user_id=house.owner_id
  from public.household_members m join auth.users u on u.id=m.user_id join public.households house on house.id=m.household_id
  where m.household_id=h order by (m.user_id=house.owner_id) desc,m.user_id;
end $$;
create function public.remove_household_member(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock(); owner_id uuid;
begin
  select x.owner_id into owner_id from public.households x where x.id=h;
  if owner_id<>auth.uid() then raise exception 'Solo el propietario puede quitar miembros'; end if;
  if p_user=owner_id then raise exception 'Transfiere la propiedad antes de salir'; end if;
  delete from public.household_members where user_id=p_user and household_id=h;
  if not found then raise exception 'Miembro no disponible'; end if;
  update public.household_invitations set revoked_at=now() where household_id=h and revoked_at is null;
end $$;
create function public.leave_household() returns void language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock();
begin
  if exists(select 1 from public.households where id=h and owner_id=auth.uid()) then raise exception 'Transfiere la propiedad o elimina la casa'; end if;
  delete from public.household_members where household_id=h and user_id=auth.uid();
end $$;
create function public.transfer_household(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare h uuid:=public.menu_house_lock();
begin
  if not exists(select 1 from public.households where id=h and owner_id=auth.uid()) then raise exception 'Solo el propietario puede transferir'; end if;
  if p_user=auth.uid() or not exists(select 1 from public.household_members where household_id=h and user_id=p_user) then raise exception 'Selecciona otro miembro de la casa'; end if;
  update public.households set owner_id=p_user where id=h;
  update public.household_invitations set revoked_at=now() where household_id=h and revoked_at is null;
end $$;

-- Al iniciar el borrado se cierran nuevas escrituras y accesos de los demás miembros.
-- Los archivos se borran por Storage API, nunca modificando storage.objects mediante SQL.
create function public.begin_household_deletion(p_house uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare house public.households;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_house::text,0));
  select * into house from public.households where id=p_house and owner_id=auth.uid() for update;
  if not found then raise exception 'Casa no disponible'; end if;
  if btrim(p_confirmation) is distinct from house.name then raise exception 'Escribe el nombre de la casa'; end if;
  update public.households set deletion_requested_at=coalesce(deletion_requested_at,now()) where id=p_house;
  update public.household_invitations set revoked_at=now() where household_id=p_house and revoked_at is null;
  delete from public.household_members where household_id=p_house and user_id<>auth.uid();
  delete from public.household_members where household_id=p_house and user_id<>auth.uid();
end $$;
create function public.finish_household_deletion(p_house uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_house::text,0));
  if not exists(select 1 from public.households where id=p_house and owner_id=auth.uid() and deletion_requested_at is not null) then raise exception 'Casa no disponible'; end if;
  if exists(select 1 from storage.objects where bucket_id='recipe-photos' and split_part(name,'/',1)=p_house::text) then raise exception 'Faltan fotos por eliminar'; end if;
  -- Orden explícito para las referencias compuestas entre catálogo, recetas y menú.
  delete from public.shopping_items where household_id=p_house;
  delete from public.menu_weeks where household_id=p_house;
  delete from public.recipes where household_id=p_house;
  delete from public.ingredients where household_id=p_house;
  delete from public.households where id=p_house;
end $$;
create policy pending_house_photos_read on storage.objects for select to authenticated using(bucket_id='recipe-photos' and exists(
  select 1 from public.households h where h.id::text=split_part(storage.objects.name,'/',1) and h.owner_id=auth.uid() and h.deletion_requested_at is not null
));
create policy pending_house_photos_delete on storage.objects for delete to authenticated using(bucket_id='recipe-photos' and exists(
  select 1 from public.households h where h.id::text=split_part(storage.objects.name,'/',1) and h.owner_id=auth.uid() and h.deletion_requested_at is not null
));

-- Mismo orden de bloqueo que el resto de operaciones: casa antes de invitación.
create or replace function public.accept_household_invitation(token text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; u uuid:=auth.uid();
begin
  if u is null then raise exception 'Inicia sesión'; end if;
  perform pg_advisory_xact_lock(hashtextextended('user:'||u::text,0));
  if exists(select 1 from public.household_members where user_id=u) then raise exception 'Ya perteneces a una casa'; end if;
  select household_id into h from public.household_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
  if h is null then raise exception 'Invitación caducada o revocada'; end if;
  perform pg_advisory_xact_lock(hashtextextended(h::text,0));
  if not exists(select 1 from public.households where id=h and deletion_requested_at is null) then raise exception 'Invitación caducada o revocada'; end if;
  perform 1 from public.household_invitations where household_id=h and token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for update;
  if not found then raise exception 'Invitación caducada o revocada'; end if;
  insert into public.household_members(user_id,household_id) values(u,h);
  return h;
end $$;
revoke all on function public.get_household_members(),public.remove_household_member(uuid),public.leave_household(),public.transfer_household(uuid),public.begin_household_deletion(uuid,text),public.finish_household_deletion(uuid) from public,anon;
grant execute on function public.get_household_members(),public.remove_household_member(uuid),public.leave_household(),public.transfer_household(uuid),public.begin_household_deletion(uuid,text),public.finish_household_deletion(uuid) to authenticated;

-- El aviso individual sigue siendo legible cuando el usuario pierde su pertenencia.
create table public.user_household_changes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0
);
alter table public.user_household_changes enable row level security;
create policy own_membership_changes on public.user_household_changes for select to authenticated using(user_id=auth.uid());
revoke all on public.user_household_changes from anon,authenticated;
grant select on public.user_household_changes to authenticated;
insert into public.user_household_changes(user_id) select user_id from public.household_members;
create function public.signal_membership_change() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
  if tg_table_name='household_members' then
    if tg_op='DELETE' then u:=old.user_id; else u:=new.user_id; end if;
    insert into public.user_household_changes(user_id,revision) values(u,1)
    on conflict(user_id) do update set revision=public.user_household_changes.revision+1;
  else
    for u in select user_id from public.household_members where household_id=new.id loop
      insert into public.user_household_changes(user_id,revision) values(u,1)
      on conflict(user_id) do update set revision=public.user_household_changes.revision+1;
    end loop;
  end if;
  return null;
end $$;
revoke all on function public.signal_membership_change() from public,anon,authenticated;
create trigger membership_change after insert or update or delete on public.household_members for each row execute function public.signal_membership_change();
create trigger household_access_change after update of owner_id,deletion_requested_at on public.households for each row execute function public.signal_membership_change();
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_household_changes') then
    alter publication supabase_realtime add table public.user_household_changes;
  end if;
end $$;
notify pgrst,'reload schema';
commit;
