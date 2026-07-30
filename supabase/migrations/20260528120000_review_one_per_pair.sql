-- One public review per (pro, reviewer); after delete, no new review for that pair.
create unique index if not exists reviews_pro_profile_reviewer_unique
  on public.reviews (pro_profile_id, reviewer_id);

create table if not exists public.review_submission_locks (
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  primary key (pro_profile_id, reviewer_id)
);

alter table public.review_submission_locks enable row level security;

drop policy if exists "Users read own review locks" on public.review_submission_locks;
create policy "Users read own review locks"
  on public.review_submission_locks for select to authenticated
  using (auth.uid() = reviewer_id);

drop policy if exists "Users insert own review locks" on public.review_submission_locks;
create policy "Users insert own review locks"
  on public.review_submission_locks for insert to authenticated
  with check (auth.uid() = reviewer_id);

create or replace function public.lock_review_pair_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.review_submission_locks (pro_profile_id, reviewer_id)
  values (old.pro_profile_id, old.reviewer_id)
  on conflict (pro_profile_id, reviewer_id) do nothing;
  return old;
end;
$$;

drop trigger if exists reviews_lock_pair_on_delete on public.reviews;
create trigger reviews_lock_pair_on_delete
  after delete on public.reviews
  for each row execute function public.lock_review_pair_on_delete();

create table if not exists public.client_review_submission_locks (
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  locked_at timestamptz not null default now(),
  primary key (pro_profile_id, client_id)
);

alter table public.client_review_submission_locks enable row level security;

drop policy if exists "Pros read client review locks" on public.client_review_submission_locks;
create policy "Pros read client review locks"
  on public.client_review_submission_locks for select to authenticated
  using (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = auth.uid()
    )
  );

drop policy if exists "Pros insert client review locks" on public.client_review_submission_locks;
create policy "Pros insert client review locks"
  on public.client_review_submission_locks for insert to authenticated
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = auth.uid()
    )
  );

create or replace function public.lock_client_review_pair_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_review_submission_locks (pro_profile_id, client_id)
  values (old.pro_profile_id, old.client_id)
  on conflict (pro_profile_id, client_id) do nothing;
  return old;
end;
$$;

drop trigger if exists client_reviews_lock_pair_on_delete on public.client_reviews;
create trigger client_reviews_lock_pair_on_delete
  after delete on public.client_reviews
  for each row execute function public.lock_client_review_pair_on_delete();
