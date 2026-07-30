-- Optional photos on pro→client reviews (dashboard display).
alter table public.client_reviews
  add column if not exists photo_urls text[] not null default '{}';

comment on column public.client_reviews.photo_urls is 'Public URLs of review images (review-photos bucket).';
