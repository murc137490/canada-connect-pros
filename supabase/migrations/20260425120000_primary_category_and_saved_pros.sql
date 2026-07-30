-- One core category per pro (e.g. only Business Services); subservices are rows in pro_services.
alter table public.pro_profiles
  add column if not exists primary_category_slug text;

-- Personalized label on the public profile (e.g. "phone repair" for an IT Support subservice)
alter table public.pro_services
  add column if not exists display_name text;

-- Client bookmarks (Saved Pros in dashboard)
create table if not exists public.client_saved_pros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pro_profile_id uuid not null references public.pro_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, pro_profile_id)
);

create index if not exists client_saved_pros_user_id_idx on public.client_saved_pros (user_id);
create index if not exists client_saved_pros_pro_profile_id_idx on public.client_saved_pros (pro_profile_id);

alter table public.client_saved_pros enable row level security;

drop policy if exists "Users read own client_saved_pros" on public.client_saved_pros;
create policy "Users read own client_saved_pros"
  on public.client_saved_pros for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own client_saved_pros" on public.client_saved_pros;
create policy "Users insert own client_saved_pros"
  on public.client_saved_pros for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own client_saved_pros" on public.client_saved_pros;
create policy "Users delete own client_saved_pros"
  on public.client_saved_pros for delete
  using (auth.uid() = user_id);
