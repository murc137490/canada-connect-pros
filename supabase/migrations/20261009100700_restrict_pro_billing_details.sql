-- Security review 2026-10-08 follow-up (Aymen: "only what's in the pro file is public").
-- Invoice supplier fields (business address, GST/QST, legal name) are no longer readable by every
-- signed-in user. get_pro_billing_details() now answers only to:
--   * the pro themself, * platform moderators/admins,
--   * a client with a booking (any status) or a payment row (any status) with that pro.
-- Checkout never needs them before the booking exists: the bookings trigger below writes the
-- supplier fields into invoice_snapshot server-side on insert (and keeps them from being edited),
-- and pro_billing_ready() lets the UI check, before payment, that the pro has a billing address.

create or replace function public.get_pro_billing_details(p_pro_profile_ids uuid[])
returns table (
  id uuid,
  legal_business_name text,
  business_address text,
  location text,
  gst_registration_number text,
  qst_registration_number text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.legal_business_name, p.business_address, p.location,
         p.gst_registration_number, p.qst_registration_number
  from public.pro_profiles p
  where auth.uid() is not null
    and p.id = any (p_pro_profile_ids[1:50])
    and (
      p.user_id = auth.uid()
      or public.auth_is_platform_moderator()
      or exists (select 1 from public.bookings b where b.pro_profile_id = p.id and b.client_id = auth.uid())
      or exists (select 1 from public.payments pay where pay.pro_profile_id = p.id and pay.client_id = auth.uid())
    );
$$;
revoke all on function public.get_pro_billing_details(uuid[]) from public, anon;
grant execute on function public.get_pro_billing_details(uuid[]) to authenticated;

-- Pre-payment check only: does this pro have an invoice address on file? (no address returned)
create or replace function public.pro_billing_ready(p_pro_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select nullif(btrim(coalesce(p.business_address, '')), '') is not null
        or nullif(btrim(coalesce(p.location, '')), '') is not null
    from public.pro_profiles p
    where p.id = p_pro_profile_id
  ), false);
$$;
revoke all on function public.pro_billing_ready(uuid) from public;
grant execute on function public.pro_billing_ready(uuid) to anon, authenticated;

-- Server-authoritative invoice supplier fields on bookings.invoice_snapshot.
create or replace function public.bookings_fill_invoice_supplier()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_addr text;
  v_gst text;
  v_qst text;
begin
  if new.invoice_snapshot is null or jsonb_typeof(new.invoice_snapshot) <> 'object'
     or not (new.invoice_snapshot ? 'supplier_address') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Supplier fields are fixed once the booking exists (clients can't rewrite them).
    if old.invoice_snapshot is not null and jsonb_typeof(old.invoice_snapshot) = 'object'
       and old.invoice_snapshot ? 'supplier_address' then
      new.invoice_snapshot := new.invoice_snapshot || jsonb_build_object(
        'supplier_address', old.invoice_snapshot -> 'supplier_address',
        'supplier_gst_number', old.invoice_snapshot -> 'supplier_gst_number',
        'supplier_qst_number', old.invoice_snapshot -> 'supplier_qst_number'
      );
      return new;
    end if;
  end if;

  select coalesce(nullif(btrim(p.business_address), ''), nullif(btrim(p.location), ''), ''),
         nullif(btrim(p.gst_registration_number), ''),
         nullif(btrim(p.qst_registration_number), '')
    into v_addr, v_gst, v_qst
  from public.pro_profiles p
  where p.id = new.pro_profile_id;

  if found then
    new.invoice_snapshot := new.invoice_snapshot || jsonb_build_object(
      'supplier_address', v_addr,
      'supplier_gst_number', v_gst,
      'supplier_qst_number', v_qst
    );
  end if;
  return new;
end;
$$;
revoke all on function public.bookings_fill_invoice_supplier() from public, anon, authenticated;

drop trigger if exists trg_bookings_01_fill_invoice_supplier on public.bookings;
create trigger trg_bookings_01_fill_invoice_supplier
  before insert or update of invoice_snapshot on public.bookings
  for each row execute function public.bookings_fill_invoice_supplier();
