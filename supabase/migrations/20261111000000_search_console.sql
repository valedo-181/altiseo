-- Suivi des mots-clés : connexion d'un site à Google Search Console et dernier rapport.
-- Le jeton Google est chiffré côté serveur (AES-256-GCM, ENCRYPTION_KEY) et n'est jamais lisible par
-- le navigateur ; seul le serveur (service_role) écrit dans ces tables.

create table public.search_connections (
  site_id uuid primary key references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  property text not null,                         -- « sc-domain:exemple.ch » ou « https://exemple.ch/ »
  credentials_enc bytea,                          -- jeton de renouvellement chiffré ; null en mode démo
  status text not null default 'ok' check (status in ('ok', 'error')),
  last_error text,
  last_synced_at timestamptz,
  demo boolean not null default false,
  report jsonb,                                   -- dernier rapport (90 jours), refait à chaque synchronisation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index search_connections_workspace_idx on public.search_connections (workspace_id);

create trigger search_connections_ws before insert or update on public.search_connections
  for each row execute function public.check_site_workspace();
create trigger search_connections_touch before update on public.search_connections
  for each row execute function public.touch_updated_at();

alter table public.search_connections enable row level security;
create policy search_connections_select on public.search_connections for select using (public.is_member(workspace_id));

-- Lecture colonne par colonne : tout sauf le jeton. Aucune écriture pour les membres.
revoke all on public.search_connections from anon, authenticated;
grant select (site_id, workspace_id, property, status, last_error, last_synced_at, demo, report, created_at, updated_at)
  on public.search_connections to authenticated;
