-- Publicités : les annonces Google Ads et Meta Ads préparées pour un article. Altiseo prépare, la
-- personne valide puis met en ligne elle-même : rien n'est envoyé aux régies depuis cette table.
-- Lecture pour les membres ; écriture par le serveur seulement (la préparation coûte un appel à l'IA).

create table public.ad_drafts (
  article_id uuid primary key references public.articles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  google jsonb not null,                          -- titres, descriptions, chemins, mots-clés, exclusions
  meta jsonb not null,                            -- textes, titre, description, bouton
  landing_url text not null check (landing_url ~ '^https://' and length(landing_url) <= 600),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  demo boolean not null default false,            -- annonces d'exemple (sans IA)
  generations smallint not null default 1 check (generations between 1 and 50),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_drafts_workspace_idx on public.ad_drafts (workspace_id);
create index ad_drafts_site_idx on public.ad_drafts (site_id, updated_at desc);

create trigger ad_drafts_ws before insert or update on public.ad_drafts
  for each row execute function public.check_site_workspace();
create trigger ad_drafts_touch before update on public.ad_drafts
  for each row execute function public.touch_updated_at();

alter table public.ad_drafts enable row level security;
create policy ad_drafts_select on public.ad_drafts for select using (public.is_member(workspace_id));
revoke all on public.ad_drafts from anon, authenticated;
grant select on public.ad_drafts to authenticated;
