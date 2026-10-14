do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'pro_application_review_notices'
     ) then
    alter publication supabase_realtime add table public.pro_application_review_notices;
  end if;
end
$$;
