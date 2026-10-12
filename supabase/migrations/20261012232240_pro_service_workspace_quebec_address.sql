-- Apply the Québec-only physical address rule to professional service workspaces.
create or replace function public.validate_pro_service_workspace_quebec_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_address is distinct from (case when tg_op = 'UPDATE' then old.workspace_address else null end)
     and not public.is_quebec_physical_address(new.workspace_address) then
    raise exception 'Workspace address must be in Québec.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists pro_services_quebec_workspace_address_guard on public.pro_services;
create trigger pro_services_quebec_workspace_address_guard
before insert or update of workspace_address on public.pro_services
for each row execute function public.validate_pro_service_workspace_quebec_address();
