-- Security review 2026-10-08, MED 7: only http(s) URLs may be stored as a pro's website
-- (blocks javascript:/data: links). NOT VALID so existing rows are not re-checked (all current
-- values already pass); new inserts/updates are enforced. The UI also runs safeHttpUrl().
alter table public.pro_profiles drop constraint if exists pro_profiles_website_http_check;
alter table public.pro_profiles
  add constraint pro_profiles_website_http_check
  check (website is null or btrim(website) = '' or website ~* '^https?://[^\s]+$') not valid;
