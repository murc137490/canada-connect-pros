-- Allow the platform admin (dashboard) to read all pro_subscriptions for support / approval UI.
-- Existing policy keeps "users read own row"; this adds an OR for the admin JWT email.

drop policy if exists "Admin read all pro subscriptions by email" on public.pro_subscriptions;
create policy "Admin read all pro subscriptions by email"
  on public.pro_subscriptions for select
  to authenticated
  using (
    lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'premiereservicescontact@gmail.com'
  );
