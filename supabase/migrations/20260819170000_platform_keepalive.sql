-- Lightweight row for Free-tier keep-alive pings (GitHub Action / cron).
create table if not exists public.platform_keepalive (
  id integer primary key check (id = 1),
  last_ping_at timestamptz not null default now(),
  ping_count bigint not null default 0
);

insert into public.platform_keepalive (id, last_ping_at, ping_count)
values (1, now(), 0)
on conflict (id) do nothing;

alter table public.platform_keepalive enable row level security;

drop policy if exists "Anon can read keepalive" on public.platform_keepalive;
create policy "Anon can read keepalive"
  on public.platform_keepalive for select
  to anon, authenticated
  using (id = 1);

drop policy if exists "Anon can update keepalive" on public.platform_keepalive;
create policy "Anon can update keepalive"
  on public.platform_keepalive for update
  to anon, authenticated
  using (id = 1)
  with check (id = 1);

grant select, update on public.platform_keepalive to anon, authenticated;
