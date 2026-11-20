create table public.eshveh_preview_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object')
);
alter table public.eshveh_preview_state enable row level security;
revoke all on public.eshveh_preview_state from anon, authenticated;
grant select, insert, update on public.eshveh_preview_state to authenticated;
create policy "Owners read preview state" on public.eshveh_preview_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners insert preview state" on public.eshveh_preview_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update preview state" on public.eshveh_preview_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
