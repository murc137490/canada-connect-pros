-- ID selfie and document URLs on pro_profiles (admin review + verification).
alter table public.pro_profiles
  add column if not exists personal_photo_url text,
  add column if not exists id_document_url text;

comment on column public.pro_profiles.personal_photo_url is 'Private selfie URL for admin verification (not public).';
comment on column public.pro_profiles.id_document_url is 'Private government ID image URL for admin verification (not public).';
