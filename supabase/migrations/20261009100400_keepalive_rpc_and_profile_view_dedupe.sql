-- Security review 2026-10-08, LOW 12 (live-safe part).

-- Keep-alive: a narrow RPC the GitHub workflow can call instead of PATCHing the table as anon.
-- The anon UPDATE grant/policy is removed in 20261009100500 (after this PR's workflow change merges).
create or replace function public.platform_keepalive_ping()
returns timestamptz
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.platform_keepalive
  set last_ping_at = now(), ping_count = coalesce(ping_count, 0) + 1
  where id = 1
  returning last_ping_at;
$$;
revoke all on function public.platform_keepalive_ping() from public;
grant execute on function public.platform_keepalive_ping() to anon, authenticated;

-- pro_profile_views: anyone may still record a view, but repeated inserts for the same pro from the
-- same viewer (user id, else client IP from PostgREST headers) within 30 minutes are dropped, and
-- created_at can't be forged.
alter table public.pro_profile_views add column if not exists viewer_hash text;
create index if not exists pro_profile_views_dedupe_idx
  on public.pro_profile_views (pro_profile_id, viewer_hash, created_at desc);

create or replace function public.pro_profile_views_dedupe()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
  new.created_at := now();
  new.viewer_hash := md5(coalesce(auth.uid()::text, nullif(btrim(v_ip), ''), 'unknown') || ':' || new.pro_profile_id::text);
  if exists (
    select 1 from public.pro_profile_views v
    where v.pro_profile_id = new.pro_profile_id
      and v.viewer_hash = new.viewer_hash
      and v.created_at > now() - interval '30 minutes'
  ) then
    return null; -- silently skip the duplicate
  end if;
  return new;
end;
$$;
revoke all on function public.pro_profile_views_dedupe() from public, anon, authenticated;

drop trigger if exists trg_pro_profile_views_dedupe on public.pro_profile_views;
create trigger trg_pro_profile_views_dedupe
  before insert on public.pro_profile_views
  for each row execute function public.pro_profile_views_dedupe();

-- Views are insert-only from the browser.
revoke update, delete, truncate, references, trigger on public.pro_profile_views from anon, authenticated;
-- viewer_hash must not be readable (it is derived from the viewer's IP): pros keep reading
-- id / pro_profile_id / created_at of their own views (RLS) for the view counter.
revoke select on public.pro_profile_views from anon, authenticated;
grant select (id, pro_profile_id, created_at) on public.pro_profile_views to authenticated;
