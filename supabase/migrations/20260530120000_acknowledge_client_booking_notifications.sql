-- Bulk-clear client booking notification flags (mirrors acknowledge_pro_booking_notifications).
create or replace function public.acknowledge_client_booking_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set client_unread = false
  where client_id = auth.uid()
    and client_unread = true;
end;
$$;

revoke all on function public.acknowledge_client_booking_notifications() from public;
grant execute on function public.acknowledge_client_booking_notifications() to authenticated;
