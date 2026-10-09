-- Security review 2026-10-08, HIGH 2.
-- 20260819010000_legal_security_remediation tried to remove the pro read access to
-- client ID-verification photos but dropped the wrong policy name, so pros could still
-- SELECT/sign objects in the private client-booking-verification bucket for any client
-- with a pending/accepted/completed booking.
-- The app only shows pros a verification *status* (Dashboard.tsx sets the path to null,
-- "status only (LR-007)"); no client code signs or downloads another user's ID photo.
-- Owner policies ("Users read/upload/update/delete own client-booking-verification") stay.
drop policy if exists "Pros read client booking verification for their bookings" on storage.objects;
