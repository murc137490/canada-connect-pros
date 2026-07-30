-- Growth-tier service extras, booking lifecycle (accepted), response time, client/pro unread, bundles, RPC acks.

-- 1) pro_services
alter table public.pro_services add column if not exists auto_reply_message text;
alter table public.pro_services add column if not exists renewal_interval_months int;
alter table public.pro_services drop constraint if exists pro_services_renewal_interval_months_check;
alter table public.pro_services add constraint pro_services_renewal_interval_months_check
  check (renewal_interval_months is null or (renewal_interval_months >= 1 and renewal_interval_months <= 120));

comment on column public.pro_services.auto_reply_message is 'Growth/Pro: message shown to the client after booking (e.g. availability note).';
comment on column public.pro_services.renewal_interval_months is 'Growth/Pro: optional cadence (e.g. 12 = yearly) for recurring service offers.';

-- 2) bookings — new columns
alter table public.bookings add column if not exists responded_at timestamptz;
alter table public.bookings add column if not exists auto_reply_snapshot text;
alter table public.bookings add column if not exists renewal_interval_months_snapshot int;
alter table public.bookings add column if not exists client_renews_annually boolean not null default false;
alter table public.bookings add column if not exists renewal_anchor_date date;
alter table public.bookings add column if not exists service_category_slug text;
alter table public.bookings add column if not exists service_slug text;
alter table public.bookings add column if not exists client_unread boolean not null default false;
alter table public.bookings add column if not exists pro_unread boolean not null default true;

comment on column public.bookings.responded_at is 'When the pro first accepted or declined this request.';
comment on column public.bookings.auto_reply_snapshot is 'Copy of pro auto-reply at booking time.';
comment on column public.bookings.client_unread is 'Client notification dot until acknowledged.';
comment on column public.bookings.pro_unread is 'Pro notification until bookings tab viewed (cleared via RPC).';

-- 3) status: add accepted (pending -> accepted -> completed)
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'accepted', 'completed', 'cancelled', 'declined'));

-- 4) RPC: client acknowledges notification (no broad client UPDATE policy)
create or replace function public.acknowledge_client_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set client_unread = false
  where id = p_booking_id and client_id = auth.uid();
end;
$$;

revoke all on function public.acknowledge_client_booking(uuid) from public;
grant execute on function public.acknowledge_client_booking(uuid) to authenticated;

create or replace function public.acknowledge_pro_booking_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings b
  set pro_unread = false
  from public.pro_profiles pp
  where b.pro_profile_id = pp.id
    and pp.user_id = auth.uid()
    and b.pro_unread = true;
end;
$$;

revoke all on function public.acknowledge_pro_booking_notifications() from public;
grant execute on function public.acknowledge_pro_booking_notifications() to authenticated;

-- 5) Bundles
create table if not exists public.service_bundles (
  id uuid primary key default gen_random_uuid(),
  pro_profile_id uuid not null references public.pro_profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_bundle_items (
  bundle_id uuid not null references public.service_bundles (id) on delete cascade,
  category_slug text not null,
  service_slug text not null,
  primary key (bundle_id, category_slug, service_slug)
);

create index if not exists idx_service_bundles_pro on public.service_bundles (pro_profile_id);

alter table public.service_bundles enable row level security;
alter table public.service_bundle_items enable row level security;

drop policy if exists "Anyone can read service bundles" on public.service_bundles;
create policy "Anyone can read service bundles" on public.service_bundles for select using (true);

drop policy if exists "Pro inserts own service bundle" on public.service_bundles;
create policy "Pro inserts own service bundle" on public.service_bundles for insert with check (
  exists (select 1 from public.pro_profiles pp where pp.id = pro_profile_id and pp.user_id = auth.uid())
);

drop policy if exists "Pro updates own service bundle" on public.service_bundles;
create policy "Pro updates own service bundle" on public.service_bundles for update using (
  exists (select 1 from public.pro_profiles pp where pp.id = pro_profile_id and pp.user_id = auth.uid())
);

drop policy if exists "Pro deletes own service bundle" on public.service_bundles;
create policy "Pro deletes own service bundle" on public.service_bundles for delete using (
  exists (select 1 from public.pro_profiles pp where pp.id = pro_profile_id and pp.user_id = auth.uid())
);

drop policy if exists "Anyone can read bundle items" on public.service_bundle_items;
create policy "Anyone can read bundle items" on public.service_bundle_items for select using (true);

drop policy if exists "Pro inserts bundle items" on public.service_bundle_items;
create policy "Pro inserts bundle items" on public.service_bundle_items for insert with check (
  exists (
    select 1 from public.service_bundles sb
    join public.pro_profiles pp on pp.id = sb.pro_profile_id
    where sb.id = bundle_id and pp.user_id = auth.uid()
  )
);

drop policy if exists "Pro deletes bundle items" on public.service_bundle_items;
create policy "Pro deletes bundle items" on public.service_bundle_items for delete using (
  exists (
    select 1 from public.service_bundles sb
    join public.pro_profiles pp on pp.id = sb.pro_profile_id
    where sb.id = bundle_id and pp.user_id = auth.uid()
  )
);
