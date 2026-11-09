-- Schéma du produit « blog SEO automatique » (clone fonctionnel, périmètre de replica/recon.md).
-- Postgres 16 sur Supabase. Toutes les tables métier portent workspace_id et sont protégées par RLS :
-- un membre d'un espace ne voit que cet espace, même par l'API. Les tâches de fond (rédaction,
-- publication, audit) écrivent avec la clé service_role, côté serveur uniquement.
-- Heures en timestamptz (UTC), montants en centimes entiers + devise.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Espaces et membres
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create or replace function public.is_member(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.workspace_id = wid and m.user_id = auth.uid());
$$;

create or replace function public.is_admin(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
                  where m.workspace_id = wid and m.user_id = auth.uid() and m.role in ('owner', 'admin'));
$$;

-- ---------------------------------------------------------------------------
-- Abonnement (un par espace) et quotas
-- ---------------------------------------------------------------------------

create table public.plans (
  code text primary key,                         -- 'grow', 'scale'
  articles_per_month int not null check (articles_per_month > 0),
  languages int not null check (languages > 0),
  sites int not null check (sites > 0),
  price_month_cents int not null check (price_month_cents >= 0),
  price_year_cents int not null check (price_year_cents >= 0),
  currency char(3) not null default 'CHF',
  active boolean not null default true
);

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan_code text not null references public.plans (code) on delete restrict,
  interval text not null default 'month' check (interval in ('month', 'year')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '1 month',
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint period_order check (current_period_end > current_period_start)
);

-- Webhooks Stripe : chaque événement n'est traité qu'une fois (Stripe renvoie parfois deux fois).
create table public.stripe_events (
  id text primary key,                           -- evt_…
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Sites et profil de marque
-- ---------------------------------------------------------------------------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  name text,
  language text not null default 'fr' check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  business_description text check (length(business_description) <= 4000),
  target_audience text check (length(target_audience) <= 2000),
  tone text check (length(tone) <= 200),
  custom_instructions text check (length(custom_instructions) <= 1000),
  mention_competitors boolean not null default true,
  -- Planning : heure locale de publication et fuseau (ex. 'Europe/Zurich')
  publish_time time not null default '08:00',
  timezone text not null default 'Europe/Zurich',
  publish_days smallint[] not null default '{1,2,3,4,5,6,7}',   -- ISO : 1 = lundi
  publish_mode text not null default 'draft' check (publish_mode in ('draft', 'publish')),
  featured_images boolean not null default true,
  target_words int not null default 1800 check (target_words between 600 and 5000),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 8),
  analyzed_at timestamptz,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, url)
);
create index sites_workspace_idx on public.sites (workspace_id);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  name text,
  source text not null default 'manual' check (source in ('suggested', 'manual')),
  created_at timestamptz not null default now(),
  unique (site_id, url)
);
create index competitors_workspace_idx on public.competitors (workspace_id);

-- ---------------------------------------------------------------------------
-- Intégrations CMS
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  kind text not null
    check (kind in ('wordpress', 'webflow', 'shopify', 'framer', 'wix', 'ghost', 'webhook')),
  -- Identifiants chiffrés côté serveur (AES-256-GCM, clé dans ENCRYPTION_KEY) ; jamais lus par le navigateur.
  credentials_enc bytea,
  config jsonb not null default '{}',            -- ex. { "blog_id": "…", "collection_id": "…" }
  status text not null default 'pending' check (status in ('pending', 'ok', 'error', 'disabled')),
  last_error text,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integrations_workspace_idx on public.integrations (workspace_id);
create index integrations_site_idx on public.integrations (site_id);
-- Une seule intégration active par site : c'est là que partent les articles.
create unique index integrations_one_active on public.integrations (site_id) where status <> 'disabled';

-- Le navigateur ne lit jamais les identifiants : vue sans la colonne chiffrée.
create view public.integrations_public with (security_invoker = true) as
  select id, workspace_id, site_id, kind, config, status, last_error, last_tested_at, created_at, updated_at
    from public.integrations;

-- ---------------------------------------------------------------------------
-- Pages du site (exploration) : pour les liens internes et l'audit
-- ---------------------------------------------------------------------------

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  url text not null,
  title text,
  summary text,                                  -- 1–2 phrases, pour choisir les liens internes
  is_article boolean not null default false,
  last_crawled_at timestamptz not null default now(),
  unique (site_id, url)
);
create index site_pages_workspace_idx on public.site_pages (workspace_id);

-- ---------------------------------------------------------------------------
-- Mots-clés, calendrier, articles
-- ---------------------------------------------------------------------------

create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  phrase citext not null check (length(phrase) between 2 and 200),
  language text not null,
  search_volume int check (search_volume >= 0),
  difficulty smallint check (difficulty between 0 and 100),
  intent text check (intent in ('informational', 'commercial', 'transactional', 'navigational')),
  source text not null default 'dataforseo',
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, phrase, language)
);
create index keywords_workspace_idx on public.keywords (workspace_id);

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  scheduled_for date not null,                   -- jour local du site
  title text not null check (length(title) between 3 and 200),
  angle text check (length(angle) <= 1000),
  seed_keyword_id uuid references public.keywords (id) on delete set null,
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'generating', 'done', 'failed', 'skipped')),
  regenerations smallint not null default 0 check (regenerations between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, scheduled_for)                -- un sujet par jour et par site
);
create index calendar_items_workspace_idx on public.calendar_items (workspace_id);
create index calendar_items_due_idx on public.calendar_items (status, scheduled_for);
create index calendar_items_keyword_idx on public.calendar_items (seed_keyword_id);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  calendar_item_id uuid unique references public.calendar_items (id) on delete set null,
  title text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  meta_title text check (length(meta_title) <= 70),
  meta_description text check (length(meta_description) <= 170),
  body_html text not null default '',
  language text not null,
  keywords text[] not null default '{}',
  featured_image_path text,                      -- Supabase Storage
  schema_jsonld jsonb,
  internal_links jsonb not null default '[]'
    check (jsonb_typeof(internal_links) = 'array' and jsonb_array_length(internal_links) <= 10),
  word_count int not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'failed', 'archived')),
  -- Coût IA (suivi des marges) : jetons et coût estimé en micro-dollars
  ai_input_tokens int not null default 0,
  ai_output_tokens int not null default 0,
  ai_cost_micro_usd int not null default 0,
  counted_in_period date,                        -- début de période d'abonnement qui a consommé le quota
  edited_at timestamptz,                         -- dernière modification à la main
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);
create index articles_workspace_idx on public.articles (workspace_id);
create index articles_site_status_idx on public.articles (site_id, status, created_at desc);
create index articles_quota_idx on public.articles (workspace_id, counted_in_period);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  integration_id uuid not null references public.integrations (id) on delete cascade,
  remote_id text,                                -- id du billet dans le CMS : republier = mettre à jour
  remote_url text,
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  attempts smallint not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, integration_id)            -- jamais deux billets pour le même article
);
create index publications_workspace_idx on public.publications (workspace_id);
create index publications_integration_idx on public.publications (integration_id);

-- ---------------------------------------------------------------------------
-- Audit technique
-- ---------------------------------------------------------------------------

create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  pages_crawled int not null default 0,
  score smallint check (score between 0 and 100),
  speed jsonb,                                   -- { score, lcp_ms, cls, inp_ms, fcp_ms }
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index audit_runs_workspace_idx on public.audit_runs (workspace_id);
create index audit_runs_site_idx on public.audit_runs (site_id, created_at desc);
-- Un seul audit en cours par site.
create unique index audit_runs_one_running on public.audit_runs (site_id) where status in ('queued', 'running');

create table public.audit_issues (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  audit_run_id uuid not null references public.audit_runs (id) on delete cascade,
  code text not null,                            -- 'title', 'description', 'img_alt', 'broken', 'sitemap', 'schema'…
  level text not null check (level in ('critical', 'warning', 'info')),
  affected int not null default 0,
  total int not null default 0,
  pages text[] not null default '{}',            -- 10 adresses au plus
  detail text,
  unique (audit_run_id, code)
);
create index audit_issues_workspace_idx on public.audit_issues (workspace_id);

-- ---------------------------------------------------------------------------
-- Clés API (API publique, F-API) et file de tâches
-- ---------------------------------------------------------------------------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  label text not null default 'Clé API',
  prefix text not null,                          -- 8 premiers caractères, pour la reconnaître à l'écran
  key_hash bytea not null unique,                -- sha256 ; la clé entière n'est montrée qu'une fois
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_workspace_idx on public.api_keys (workspace_id);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  kind text not null check (kind in
    ('analyze_site', 'build_calendar', 'fetch_keywords', 'write_article', 'publish', 'audit', 'crawl')),
  dedupe_key text not null unique,               -- ex. 'write_article:<calendar_item_id>' : une tâche, une fois
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'dead')),
  attempts smallint not null default 0,
  max_attempts smallint not null default 5,
  run_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_due_idx on public.jobs (status, run_at);
create index jobs_workspace_idx on public.jobs (workspace_id);

-- Lots envoyés à la Batch API de Claude (rédaction de nuit à -50 %)
create table public.ai_batches (
  id text primary key,                           -- msgbatch_…
  status text not null default 'in_progress' check (status in ('in_progress', 'ended', 'failed')),
  request_count int not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Quota : un article rédigé consomme une unité de la période en cours
-- ---------------------------------------------------------------------------

create or replace function public.articles_left(wid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(p.articles_per_month), 0)
         - (select count(*) from public.articles a
             where a.workspace_id = wid and a.counted_in_period = s.current_period_start::date)::int
    from public.subscriptions s join public.plans p on p.code = s.plan_code
   where s.workspace_id = wid and s.status in ('trialing', 'active')
   group by s.current_period_start;
$$;

-- Le quota est vérifié dans la base : deux tâches en parallèle ne peuvent pas le dépasser.
create or replace function public.articles_quota_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  period date;
begin
  if new.counted_in_period is null then
    return new;
  end if;
  select current_period_start::date into period from public.subscriptions
   where workspace_id = new.workspace_id and status in ('trialing', 'active')
   for update;                                   -- verrou : les insertions d'un même espace passent l'une après l'autre
  if period is null then
    raise exception 'Aucun abonnement actif' using errcode = 'Q0002';
  end if;
  new.counted_in_period := period;
  if coalesce(public.articles_left(new.workspace_id), 0) <= 0 then
    raise exception 'Quota d''articles atteint pour ce mois' using errcode = 'Q0001';
  end if;
  return new;
end;
$$;
create trigger articles_quota before insert on public.articles
  for each row execute function public.articles_quota_guard();

-- workspace_id d'une ligne enfant = celui de son site (empêche de rattacher un site d'un autre espace).
create or replace function public.check_site_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sites s where s.id = new.site_id and s.workspace_id = new.workspace_id) then
    raise exception 'Site d''un autre espace' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger competitors_ws before insert or update on public.competitors for each row execute function public.check_site_workspace();
create trigger integrations_ws before insert or update on public.integrations for each row execute function public.check_site_workspace();
create trigger site_pages_ws before insert or update on public.site_pages for each row execute function public.check_site_workspace();
create trigger keywords_ws before insert or update on public.keywords for each row execute function public.check_site_workspace();
create trigger calendar_items_ws before insert or update on public.calendar_items for each row execute function public.check_site_workspace();
create trigger articles_ws before insert or update on public.articles for each row execute function public.check_site_workspace();
create trigger audit_runs_ws before insert or update on public.audit_runs for each row execute function public.check_site_workspace();

-- updated_at tenu par la base
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
do $$
declare t text;
begin
  foreach t in array array['workspaces', 'subscriptions', 'sites', 'integrations', 'calendar_items',
                           'articles', 'publications', 'jobs'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Création d'un espace : le créateur en devient propriétaire, essai de 3 jours
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace(ws_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  insert into public.workspaces (name) values (ws_name) returning id into wid;
  insert into public.memberships (workspace_id, user_id, role) values (wid, auth.uid(), 'owner');
  return wid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.sites enable row level security;
alter table public.competitors enable row level security;
alter table public.integrations enable row level security;
alter table public.site_pages enable row level security;
alter table public.keywords enable row level security;
alter table public.calendar_items enable row level security;
alter table public.articles enable row level security;
alter table public.publications enable row level security;
alter table public.audit_runs enable row level security;
alter table public.audit_issues enable row level security;
alter table public.api_keys enable row level security;
alter table public.jobs enable row level security;
alter table public.ai_batches enable row level security;

create policy workspaces_select on public.workspaces for select using (public.is_member(id));
create policy workspaces_update on public.workspaces for update using (public.is_admin(id)) with check (public.is_admin(id));

create policy memberships_select on public.memberships for select using (public.is_member(workspace_id));
create policy memberships_admin on public.memberships for all
  using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

create policy plans_select on public.plans for select using (active);

-- Abonnement : lecture seule pour les membres ; seuls les webhooks Stripe (service_role) écrivent.
create policy subscriptions_select on public.subscriptions for select using (public.is_member(workspace_id));

-- stripe_events, jobs, ai_batches : aucune politique = aucun accès depuis le navigateur.

-- Tables lues et modifiées par les membres de l'espace
create policy sites_all on public.sites for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy competitors_all on public.competitors for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy calendar_items_all on public.calendar_items for all
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- Articles : les membres lisent et corrigent ; la création passe par la rédaction (service_role),
-- pour que le quota et le coût IA restent justes.
create policy articles_select on public.articles for select using (public.is_member(workspace_id));
create policy articles_update on public.articles for update
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy articles_delete on public.articles for delete using (public.is_admin(workspace_id));

-- Lecture seule pour les membres ; écrit par les tâches de fond
create policy site_pages_select on public.site_pages for select using (public.is_member(workspace_id));
create policy keywords_select on public.keywords for select using (public.is_member(workspace_id));
create policy publications_select on public.publications for select using (public.is_member(workspace_id));
create policy audit_runs_select on public.audit_runs for select using (public.is_member(workspace_id));
create policy audit_issues_select on public.audit_issues for select using (public.is_member(workspace_id));

-- Intégrations : lecture via la vue integrations_public ; écriture par les actions serveur
-- (qui chiffrent les identifiants). Le navigateur ne lit jamais credentials_enc.
create policy integrations_select on public.integrations for select using (public.is_member(workspace_id));
-- Supabase donne select sur toute la table : on le retire, puis on rend les colonnes une à une.
revoke select on public.integrations from anon, authenticated;
grant select (id, workspace_id, site_id, kind, config, status, last_error, last_tested_at, created_at, updated_at)
  on public.integrations to authenticated;

create policy api_keys_select on public.api_keys for select using (public.is_admin(workspace_id));
create policy api_keys_revoke on public.api_keys for update
  using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

-- Offres de départ (prix à fixer avec /replica-launch)
insert into public.plans (code, articles_per_month, languages, sites, price_month_cents, price_year_cents)
values ('grow', 30, 1, 1, 9900, 89100),
       ('scale', 60, 4, 3, 24900, 224100);
