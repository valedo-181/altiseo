-- Imitation minimale de Supabase pour tester la migration sur un Postgres nu.
-- NE PAS exécuter sur un vrai projet Supabase.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
-- Comme Supabase : les fonctions de public sont exécutables par anon et authenticated par défaut
alter default privileges in schema public grant execute on functions to anon, authenticated;
-- Claims du jeton (aal = niveau d'authentification : aal1, ou aal2 avec double authentification)
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
grant execute on function auth.jwt() to authenticated, anon;
alter table auth.users add column last_sign_in_at timestamptz;
-- Double authentification (facteurs TOTP de chaque compte)
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, factor_type text not null default 'totp', status text not null default 'unverified');
-- Stockage de fichiers (buckets + objets, avec RLS comme chez Supabase)
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
