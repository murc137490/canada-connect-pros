-- Feature audit fixes (2026-10-08). Approved by owner for deploy on 2026-10-08.
-- Only adds columns/policies/functions and replaces the reminders cron job. No data is deleted.

-- 1) Columns the app already uses but live never got (older migrations were never applied).
alter table public.pro_profiles
  add column if not exists pro_accent_color text,
  add column if not exists banner_image_url text,
  add column if not exists service_tags text[] default '{}'::text[];

alter table public.job_requests
  add column if not exists scheduling_mode text,
  add column if not exists time_window_code text,
  add column if not exists range_start_date date,
  add column if not exists range_end_date date,
  add column if not exists exact_time text,
  add column if not exists window_time_start text,
  add column if not exists window_time_end text;
alter table public.job_requests drop constraint if exists job_requests_scheduling_mode_check;
alter table public.job_requests add constraint job_requests_scheduling_mode_check
  check (scheduling_mode is null or scheduling_mode in ('range', 'specific_day', 'exact'));

drop policy if exists "Users can delete own job_requests" on public.job_requests;
create policy "Users can delete own job_requests" on public.job_requests
  for delete to authenticated using (auth.uid() = client_id);

-- Payment functions write payments.client_id; without it every payment-row upsert fails.
alter table public.payments add column if not exists client_id uuid references auth.users (id) on delete set null;
create index if not exists idx_payments_client_id on public.payments (client_id) where client_id is not null;
drop policy if exists "Clients can link booking to own payment" on public.payments;
create policy "Clients can link booking to own payment" on public.payments
  for update to authenticated
  using (client_id = auth.uid() and booking_id is null)
  with check (
    client_id = auth.uid() and booking_id is not null
    and exists (select 1 from public.bookings b where b.id = booking_id and b.client_id = auth.uid())
  );

-- 2) SMS bookkeeping so each booking gets at most one request/confirmation text.
alter table public.bookings
  add column if not exists sms_request_sent_at timestamptz,
  add column if not exists sms_confirmation_sent_at timestamptz;

-- 3) Cron secret lives in Vault (never in cron.job text). Edge functions check it through a
--    service_role-only RPC, so nobody has to paste a secret into the dashboard.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'booking_reminder_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'booking_reminder_cron_secret',
      'Shared secret: pg_cron -> booking-sms-reminders -> booking-sms-notify');
  end if;
end $$;

create or replace function public.internal_check_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(length(p_secret) >= 32, false) and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'booking_reminder_cron_secret' and s.decrypted_secret = p_secret
  );
$$;
revoke all on function public.internal_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.internal_check_cron_secret(text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'booking-sms-reminders-hourly') then
    perform cron.unschedule('booking-sms-reminders-hourly');
  end if;
end $$;

select cron.schedule(
  'booking-sms-reminders-hourly',
  '15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/booking-sms-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'booking_reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

-- 4) Paid tier can't be self-assigned on INSERT either (trigger used to run on UPDATE only).
create or replace function public.pro_profiles_enforce_subscription_tier_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_plan text;
begin
  if tg_op = 'UPDATE' and new.subscription_tier is not distinct from old.subscription_tier then
    return new;
  end if;
  if tg_op = 'INSERT' and (new.subscription_tier is null or lower(trim(new.subscription_tier)) = 'hold') then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or auth.uid() is null and current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if public.auth_is_platform_moderator() then
    return new;
  end if;
  select lower(trim(plan_id)) into sub_plan from public.pro_subscriptions where user_id = new.user_id limit 1;
  if sub_plan is not null and lower(trim(coalesce(new.subscription_tier, ''))) = sub_plan then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.subscription_tier := 'hold';
  else
    new.subscription_tier := old.subscription_tier;
  end if;
  return new;
end;
$$;
drop trigger if exists pro_profiles_enforce_subscription_tier_billing_trg on public.pro_profiles;
create trigger pro_profiles_enforce_subscription_tier_billing_trg
  before insert or update of subscription_tier on public.pro_profiles
  for each row execute function public.pro_profiles_enforce_subscription_tier_billing();

-- 5) is_name_taken compared each name with itself (parameter shadowed by column) -> always true.
create or replace function public.is_name_taken(full_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.full_name is not null
      and public.normalize_name(p.full_name) = public.normalize_name(is_name_taken.full_name)
  );
$$;
create or replace function public.is_name_taken_by_other(full_name text, exclude_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.full_name is not null
      and public.normalize_name(p.full_name) = public.normalize_name(is_name_taken_by_other.full_name)
      and lower(trim(u.email)) <> lower(trim(is_name_taken_by_other.exclude_email))
  );
$$;
-- Not used by the app; stop anonymous name enumeration.
revoke execute on function public.is_name_taken(text) from public, anon, authenticated;
revoke execute on function public.is_name_taken_by_other(text, text) from public, anon, authenticated;
grant execute on function public.is_name_taken(text) to service_role;
grant execute on function public.is_name_taken_by_other(text, text) to service_role;
