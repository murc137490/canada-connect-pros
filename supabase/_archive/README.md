# Archived one-off SQL (do NOT run)

These files are old hand-pasted SQL snippets, demo/showcase seeds and one-off patches from before
the project used `supabase/migrations/`. They were moved here by the 2026-10-08 security review.

**Do not paste these into the SQL editor on the production project.** Many of them:

- recreate tables, policies or grants that later migrations replaced (running them can silently
  re-open access that was locked down, e.g. broad storage `SELECT` policies or table-wide grants);
- insert demo/showcase data (fake pros, bookings, receipts);
- delete or rename rows by name (`DELETE-PRO-BY-NAME.sql`, `REMOVE-PRO-JOHN-PORK.sql`).

The source of truth for the schema is `supabase/migrations/`. If you need something from here,
write a new, reviewed migration instead.
