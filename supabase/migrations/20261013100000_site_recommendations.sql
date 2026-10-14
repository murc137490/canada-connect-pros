-- Keep abuse throttling metadata private to the service role.
alter table public.front_desk_tickets
  add column if not exists intake_ip_hash text;

create index if not exists idx_front_desk_tickets_intake_ip_recent
  on public.front_desk_tickets (intake_ip_hash, created_at desc)
  where intake_ip_hash is not null;
