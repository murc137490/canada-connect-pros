-- Server-only state and connection metadata for the Zoho Mail OAuth flow.
-- Refresh tokens are encrypted by Supabase Vault and never returned from these RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.zoho_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  initiated_by uuid not null references auth.users(id) on delete cascade,
  data_center text not null,
  accounts_server text not null,
  mailbox_hint text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.zoho_oauth_states enable row level security;
revoke all on private.zoho_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on private.zoho_oauth_states to service_role;

create table private.zoho_mail_connection (
  singleton boolean primary key default true check (singleton),
  vault_secret_id uuid not null,
  data_center text not null,
  accounts_server text not null,
  mail_api_domain text not null,
  mailbox_hint text not null,
  mailbox_verified boolean not null default false,
  granted_scopes text[] not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.zoho_mail_connection enable row level security;
revoke all on private.zoho_mail_connection from public, anon, authenticated;
grant select, insert, update, delete on private.zoho_mail_connection to service_role;

create or replace function public.zoho_oauth_create_state(
  p_state_hash text,
  p_initiated_by uuid,
  p_data_center text,
  p_accounts_server text,
  p_mailbox_hint text,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_expires_at <= now() or p_expires_at > now() + interval '15 minutes' then
    raise exception 'invalid oauth state';
  end if;
  delete from private.zoho_oauth_states where expires_at <= now();
  insert into private.zoho_oauth_states(state_hash, initiated_by, data_center, accounts_server, mailbox_hint, expires_at)
  values (p_state_hash, p_initiated_by, p_data_center, p_accounts_server, p_mailbox_hint, p_expires_at);
end;
$$;

create or replace function public.zoho_oauth_consume_state(p_state_hash text)
returns table(initiated_by uuid, data_center text, accounts_server text, mailbox_hint text)
language sql
security definer
set search_path = pg_catalog
as $$
  delete from private.zoho_oauth_states s
  where s.state_hash = p_state_hash
    and s.expires_at > now()
  returning s.initiated_by, s.data_center, s.accounts_server, s.mailbox_hint;
$$;

create or replace function public.zoho_oauth_store_connection(
  p_refresh_token text,
  p_data_center text,
  p_accounts_server text,
  p_mail_api_domain text,
  p_mailbox_hint text,
  p_granted_scopes text[],
  p_connected_by uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
begin
  if coalesce(p_refresh_token, '') = '' then
    raise exception 'missing refresh token';
  end if;
  perform pg_advisory_xact_lock(742019883);
  select c.vault_secret_id into v_secret_id
  from private.zoho_mail_connection c
  where c.singleton = true
  for update;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_refresh_token,
      'altshift_zoho_mail_refresh_token',
      'Zoho Mail refresh token for the AltShift admin mailbox integration',
      null
    );
  else
    perform vault.update_secret(
      v_secret_id,
      p_refresh_token,
      'altshift_zoho_mail_refresh_token',
      'Zoho Mail refresh token for the AltShift admin mailbox integration',
      null
    );
  end if;

  insert into private.zoho_mail_connection(
    singleton, vault_secret_id, data_center, accounts_server, mail_api_domain,
    mailbox_hint, mailbox_verified, granted_scopes, connected_by, connected_at, updated_at
  ) values (
    true, v_secret_id, p_data_center, p_accounts_server, p_mail_api_domain,
    p_mailbox_hint, false, p_granted_scopes, p_connected_by, now(), now()
  )
  on conflict (singleton) do update set
    vault_secret_id = excluded.vault_secret_id,
    data_center = excluded.data_center,
    accounts_server = excluded.accounts_server,
    mail_api_domain = excluded.mail_api_domain,
    mailbox_hint = excluded.mailbox_hint,
    mailbox_verified = false,
    granted_scopes = excluded.granted_scopes,
    connected_by = excluded.connected_by,
    connected_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.zoho_oauth_connection_status()
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select coalesce(
    (select jsonb_build_object(
      'connected', true,
      'data_center', data_center,
      'accounts_server', accounts_server,
      'mailbox_hint', mailbox_hint,
      'mailbox_verified', mailbox_verified,
      'granted_scopes', granted_scopes,
      'connected_at', connected_at
    ) from private.zoho_mail_connection where singleton = true),
    jsonb_build_object('connected', false)
  );
$$;

revoke all on function public.zoho_oauth_create_state(text, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.zoho_oauth_consume_state(text) from public, anon, authenticated;
revoke all on function public.zoho_oauth_store_connection(text, text, text, text, text, text[], uuid) from public, anon, authenticated;
revoke all on function public.zoho_oauth_connection_status() from public, anon, authenticated;
grant execute on function public.zoho_oauth_create_state(text, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.zoho_oauth_consume_state(text) to service_role;
grant execute on function public.zoho_oauth_store_connection(text, text, text, text, text, text[], uuid) to service_role;
grant execute on function public.zoho_oauth_connection_status() to service_role;

comment on schema private is 'Server-only schemas; never expose through the Supabase Data API.';
comment on table private.zoho_oauth_states is 'Short-lived, one-time hashes for Zoho Mail OAuth state; service role only.';
comment on table private.zoho_mail_connection is 'Non-public Zoho Mail connection metadata; refresh token is encrypted separately in Supabase Vault.';
