-- Track visits to /services/:category/:service/pros for "Popular" footer links.

create table if not exists public.service_browse_stats (
  category_slug text not null,
  service_slug text not null,
  browse_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (category_slug, service_slug)
);

create index if not exists service_browse_stats_count_idx
  on public.service_browse_stats (browse_count desc, updated_at desc);

alter table public.service_browse_stats enable row level security;

drop policy if exists "Anyone can read service browse stats" on public.service_browse_stats;
create policy "Anyone can read service browse stats"
  on public.service_browse_stats for select
  to anon, authenticated
  using (true);

-- Writes only via SECURITY DEFINER RPC (clients cannot insert directly).

create or replace function public.increment_service_browse_stats(p_category_slug text, p_service_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_category_slug is null or length(trim(p_category_slug)) = 0 then
    return;
  end if;
  if p_service_slug is null or length(trim(p_service_slug)) = 0 then
    return;
  end if;
  insert into public.service_browse_stats (category_slug, service_slug, browse_count, updated_at)
  values (trim(p_category_slug), trim(p_service_slug), 1, now())
  on conflict (category_slug, service_slug)
  do update set
    browse_count = public.service_browse_stats.browse_count + 1,
    updated_at = now();
end;
$$;

grant execute on function public.increment_service_browse_stats(text, text) to anon, authenticated;

create or replace function public.get_top_services_by_browse(p_limit integer default 4)
returns table (category_slug text, service_slug text, browse_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select s.category_slug, s.service_slug, s.browse_count
  from public.service_browse_stats s
  order by s.browse_count desc, s.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 4), 20));
$$;

grant execute on function public.get_top_services_by_browse(integer) to anon, authenticated;
