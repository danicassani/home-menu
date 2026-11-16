begin;
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'white' check(theme in ('white','blue','red','pink','green','yellow')),
  mode text not null default 'system' check(mode in ('system','light','dark')),
  avatar text check(avatar in ('🍋','🥑','🍅','🥕','🍓','🍊','🍇','🍍','🍉','🍒','🥝','🌶️','🍞','🥐','🍳','🏠'))
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon,authenticated;
grant select,insert,update on public.user_preferences to authenticated;
create policy preferences_read on public.user_preferences for select to authenticated using(user_id=auth.uid());
create policy preferences_insert on public.user_preferences for insert to authenticated with check(user_id=auth.uid());
create policy preferences_update on public.user_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
notify pgrst,'reload schema';
commit;
