-- Hourly jobs for Growth tools (same pattern as booking-sms-reminders-hourly: secret read from Vault at run time).
-- Both functions are no-ops until a pro turns on rebooking reminders or a repeat booking exists.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rebook-reminders-hourly') then
    perform cron.unschedule('rebook-reminders-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'booking-series-run-hourly') then
    perform cron.unschedule('booking-series-run-hourly');
  end if;
end $$;

select cron.schedule(
  'rebook-reminders-hourly',
  '45 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/rebook-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'booking_reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cmd$
);

select cron.schedule(
  'booking-series-run-hourly',
  '35 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://hptzapnrnbqlptrstjxo.supabase.co/functions/v1/booking-series-run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-booking-reminder-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'booking_reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cmd$
);
