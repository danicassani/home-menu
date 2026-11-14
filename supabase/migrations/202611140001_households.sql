-- Casas privadas e invitaciones. Aplicar una vez mediante migraciones o SQL Editor.
begin;
create table public.households (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 80),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.household_members (
 user_id uuid primary key references auth.users(id),
 household_id uuid not null references public.households(id) on delete cascade,
 unique(user_id, household_id)
);
alter table public.households add constraint owner_is_member foreign key(owner_id,id)
 references public.household_members(user_id,household_id) deferrable initially deferred;
create table public.household_invitations (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 token_hash text not null unique,
 expires_at timestamptz not null default now() + interval '7 days',
 revoked_at timestamptz
);
create function public.my_household() returns uuid language sql stable security definer set search_path = '' as $$
 select household_id from public.household_members where user_id = auth.uid()
$$;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
create policy household_read on public.households for select to authenticated using (id=public.my_household());
create policy members_read on public.household_members for select to authenticated using (household_id=public.my_household());
create policy invitations_read on public.household_invitations for select to authenticated using (
 exists(select 1 from public.households where id=household_id and owner_id=auth.uid())
);
grant select on public.households, public.household_members, public.household_invitations to authenticated;
revoke insert, update, delete on public.households, public.household_members, public.household_invitations from anon, authenticated;
create function public.create_household(house_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid; u uuid := auth.uid();
begin
 if u is null then raise exception 'Inicia sesión'; end if;
 if public.my_household() is not null then raise exception 'Ya perteneces a una casa'; end if;
 insert into public.households(name,owner_id) values(btrim(house_name),u) returning id into h;
 insert into public.household_members(user_id,household_id) values(u,h);
 return h;
end $$;
create function public.create_household_invitation() returns text language plpgsql security definer set search_path = '' as $$
declare h uuid := public.my_household(); token text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
 if not exists(select 1 from public.households where id=h and owner_id=auth.uid()) then raise exception 'Solo el propietario puede invitar'; end if;
 insert into public.household_invitations(household_id,token_hash) values(h,encode(sha256(convert_to(token,'UTF8')),'hex'));
 return token;
end $$;
create function public.revoke_household_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.household_invitations i set revoked_at=now() where i.id=invitation_id and exists(
 select 1 from public.households h where h.id=i.household_id and h.owner_id=auth.uid());
 if not found then raise exception 'Invitación no disponible'; end if;
end $$;
create function public.accept_household_invitation(token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare h uuid; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Inicia sesión'; end if;
 if public.my_household() is not null then raise exception 'Ya perteneces a una casa'; end if;
 select household_id into h from public.household_invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for update;
 if h is null then raise exception 'Invitación caducada o revocada'; end if;
 insert into public.household_members(user_id,household_id) values(u,h);
 return h;
end $$;
revoke all on function public.my_household(), public.create_household(text), public.create_household_invitation(), public.revoke_household_invitation(uuid), public.accept_household_invitation(text) from public, anon;
grant execute on function public.my_household(), public.create_household(text), public.create_household_invitation(), public.revoke_household_invitation(uuid), public.accept_household_invitation(text) to authenticated;
commit;
