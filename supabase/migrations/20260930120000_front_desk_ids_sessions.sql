-- Front Desk: pro 4-digit member IDs, letter+5 booking codes, voice sessions, support tickets

-- 1) Pro member ID (4 digits) — voice/admin display for professionals only
alter table public.pro_profiles
  add column if not exists pro_member_id text;

create or replace function public.allocate_pro_member_id()
returns text
language plpgsql
volatile
as $$
declare
  num text;
  tries int := 0;
begin
  loop
    tries := tries + 1;
    num := lpad((floor(random() * 10000)::int)::text, 4, '0');
    exit when not exists (select 1 from public.pro_profiles p where p.pro_member_id = num);
    if tries > 200 then
      raise exception 'Could not allocate pro_member_id';
    end if;
  end loop;
  return num;
end;
$$;

create or replace function public.pro_profiles_assign_pro_member_id()
returns trigger
language plpgsql
as $$
begin
  if new.pro_member_id is not null and length(trim(new.pro_member_id)) > 0 then
    return new;
  end if;
  new.pro_member_id := public.allocate_pro_member_id();
  return new;
end;
$$;

drop trigger if exists trg_pro_profiles_assign_pro_member_id on public.pro_profiles;
create trigger trg_pro_profiles_assign_pro_member_id
  before insert on public.pro_profiles
  for each row
  execute function public.pro_profiles_assign_pro_member_id();

update public.pro_profiles
set pro_member_id = public.allocate_pro_member_id()
where pro_member_id is null or length(trim(pro_member_id)) = 0;

create unique index if not exists pro_profiles_pro_member_id_uidx
  on public.pro_profiles (pro_member_id);

alter table public.pro_profiles
  drop constraint if exists pro_profiles_pro_member_id_chk;
alter table public.pro_profiles
  add constraint pro_profiles_pro_member_id_chk
  check (pro_member_id ~ '^[0-9]{4}$');

comment on column public.pro_profiles.pro_member_id is
  '4-digit public Member ID for professionals (voice/admin). Clients use profiles.public_user_number (4–5 digit display ID).';

-- 2) Booking public codes: letter + 5 digits (e.g. A12345). Old 8-digit codes remain valid.
create or replace function public.generate_public_booking_code() returns text
language plpgsql volatile as $$
declare
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  letter text;
  digits text := '';
  code text;
  i int;
  tries int := 0;
begin
  loop
    tries := tries + 1;
    letter := substr(letters, 1 + floor(random() * length(letters))::int, 1);
    digits := '';
    for i in 1..5 loop
      digits := digits || (floor(random() * 10)::int)::text;
    end loop;
    if digits = '00000' then
      digits := '10000';
    end if;
    code := letter || digits;
    exit when not exists (select 1 from public.bookings b where b.public_booking_code = code);
    if tries > 300 then
      raise exception 'Could not allocate public_booking_code';
    end if;
  end loop;
  return code;
end;
$$;

alter table public.bookings
  drop constraint if exists bookings_public_booking_code_format_chk;

-- Accept legacy 8-digit OR new letter+5
alter table public.bookings
  add constraint bookings_public_booking_code_format_chk
  check (
    public_booking_code ~ '^[0-9]{8}$'
    or public_booking_code ~ '^[A-Z][0-9]{5}$'
    or public_booking_code ~ '^(DEMO|SHOW)-'
  );

comment on column public.bookings.public_booking_code is
  'Public booking ID (Service ID on phone): letter + 5 digits e.g. A12345. Legacy 8-digit codes still valid.';

-- 3) Terms acceptance fields on bookings
alter table public.bookings
  add column if not exists booking_terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_acceptance_method text,
  add column if not exists terms_hash text;

-- 4) Front Desk voice / web sessions (server-side auth state)
create table if not exists public.front_desk_sessions (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('web', 'phone', 'demo')),
  call_control_id text,
  openai_call_id text,
  language text not null default 'en' check (language in ('en', 'fr')),
  flow text check (flow in ('new_booking', 'existing_booking')),
  authenticated boolean not null default false,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_member_id text,
  active_booking_id uuid references public.bookings(id) on delete set null,
  otp_sent_at timestamptz,
  otp_verified_at timestamptz,
  draft jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_front_desk_sessions_customer
  on public.front_desk_sessions (customer_user_id, created_at desc);

alter table public.front_desk_sessions enable row level security;

-- Service role only for voice tools; no public policies needed beyond deny-by-default RLS

-- 5) Support tickets (complaint / feedback / feature / question from voice or web)
create table if not exists public.front_desk_tickets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.front_desk_sessions(id) on delete set null,
  customer_user_id uuid references auth.users(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  kind text not null check (kind in ('question', 'complaint', 'feedback', 'feature_request', 'escalation')),
  subject text,
  body text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_front_desk_tickets_status
  on public.front_desk_tickets (status, created_at desc);

alter table public.front_desk_tickets enable row level security;

drop policy if exists "Users read own front desk tickets" on public.front_desk_tickets;
create policy "Users read own front desk tickets"
  on public.front_desk_tickets for select to authenticated
  using (customer_user_id = auth.uid());

-- 6) Demo Front Desk calendar (sample business — no external calendar)
create table if not exists public.front_desk_demo_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  slot_time time not null,
  duration_minutes int not null default 60,
  service_slug text not null default 'lawn-care',
  status text not null default 'open' check (status in ('open', 'held', 'booked')),
  booking_label text,
  created_at timestamptz not null default now(),
  unique (slot_date, slot_time, service_slug)
);

alter table public.front_desk_demo_slots enable row level security;

drop policy if exists "Anyone can read demo slots" on public.front_desk_demo_slots;
create policy "Anyone can read demo slots"
  on public.front_desk_demo_slots for select to anon, authenticated
  using (true);

-- Seed next 14 days of demo availability (idempotent-ish: only if empty)
insert into public.front_desk_demo_slots (slot_date, slot_time, service_slug, status)
select d::date,
       t::time,
       s.slug,
       'open'
from generate_series(current_date, current_date + 13, '1 day'::interval) as d
cross join (values ('09:00'), ('11:00'), ('14:00'), ('16:00')) as t(t)
cross join (values ('lawn-care'), ('leaf-cleanup'), ('house-cleaning')) as s(slug)
where not exists (select 1 from public.front_desk_demo_slots limit 1);
