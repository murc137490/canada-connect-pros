-- Vanity share URLs: https://www.altshift.ca/{share_slug}
alter table public.pro_profiles
  add column if not exists share_slug text;

create unique index if not exists pro_profiles_share_slug_uidx
  on public.pro_profiles (lower(share_slug))
  where share_slug is not null and length(trim(share_slug)) > 0;

comment on column public.pro_profiles.share_slug is
  'Public vanity path segment for /{share_slug} (e.g. aymenservices).';
