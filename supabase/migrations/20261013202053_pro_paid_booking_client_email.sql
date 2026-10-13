-- Only allow a pro to use a client's saved email after this pro's booking is confirmed and paid.
-- The email is fetched on demand and is never included in the client-history payload.
create or replace function public.pro_get_paid_booking_client_email(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_client_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'booking_email_unavailable' using errcode = '42501';
  end if;

  select b.client_id
    into v_client_id
  from public.bookings b
  join public.pro_profiles pp on pp.id = b.pro_profile_id and pp.user_id = (select auth.uid())
  where b.id = p_booking_id
    and b.client_id is not null
    and b.status in ('accepted', 'completed')
    and public.pro_has_growth_tools(b.pro_profile_id)
    and exists (
      select 1 from public.payments p
      where p.booking_id = b.id
        and lower(coalesce(p.status, '')) in ('completed', 'captured', 'paid')
    );

  if v_client_id is null then
    raise exception 'booking_email_unavailable' using errcode = '42501';
  end if;

  select nullif(trim(u.email), '')
    into v_email
  from auth.users u
  where u.id = v_client_id;

  if v_email is null then
    raise exception 'booking_email_unavailable' using errcode = 'P0002';
  end if;

  return v_email;
end;
$$;

revoke all on function public.pro_get_paid_booking_client_email(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pro_get_paid_booking_client_email(uuid) to authenticated;
