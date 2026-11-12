-- Positions Google et indexation (lot C).
-- 1. Positions : les mots-clés suivis d'un site sont cherchés sur Google une fois par semaine
--    (DataForSEO) ; on garde la place du site, l'adresse trouvée et les 3 premiers résultats.
-- 2. IndexNow : une clé par site ; les nouvelles pages sont signalées à Bing, Yandex, Seznam, Naver…
-- 3. Inspection d'URL : l'état d'indexation Google de chaque page (Search Console, lecture seule).
-- Lecture pour les membres de l'espace ; écriture par le serveur seulement (service_role).

-- Ce que chaque offre comprend : nombre de mots-clés suivis par site.
alter table public.plans
  add column rank_keywords int not null default 0 check (rank_keywords between 0 and 1000);
update public.plans set rank_keywords = 50 where code = 'grow';
update public.plans set rank_keywords = 200 where code = 'scale';

-- Mots-clés suivis, par site
create table public.rank_keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  phrase extensions.citext not null check (length(phrase) between 2 and 120),
  source text not null default 'manual' check (source in ('manual', 'calendar', 'search_console')),
  created_at timestamptz not null default now(),
  unique (site_id, phrase)
);
create index rank_keywords_workspace_idx on public.rank_keywords (workspace_id);
create trigger rank_keywords_ws before insert or update on public.rank_keywords
  for each row execute function public.check_site_workspace();

-- Quota : pas plus de mots-clés par site que l'offre n'en compte (vérifié dans la base).
create or replace function public.rank_keywords_quota_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_k int;
  n int;
begin
  select p.rank_keywords into max_k
    from public.subscriptions s join public.plans p on p.code = s.plan_code
   where s.workspace_id = new.workspace_id and s.status in ('trialing', 'active')
   for update of s;                              -- verrou : deux ajouts en même temps passent l'un après l'autre
  if max_k is null then
    raise exception 'Aucun abonnement actif' using errcode = 'Q0002';
  end if;
  select count(*) into n from public.rank_keywords where site_id = new.site_id;
  if n >= max_k then
    raise exception 'Quota de mots-clés atteint' using errcode = 'Q0001';
  end if;
  return new;
end;
$$;
create trigger rank_keywords_quota before insert on public.rank_keywords
  for each row execute function public.rank_keywords_quota_guard();

-- Une recherche Google d'un mot-clé, pour une semaine
create table public.rank_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  keyword_id uuid not null references public.rank_keywords (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),   -- lundi de la semaine
  status text not null default 'ok' check (status in ('ok', 'error')),
  position smallint check (position between 1 and 100),       -- null : pas dans les 100 premiers
  url text check (length(url) <= 2000),                       -- page du site trouvée
  top jsonb not null default '[]',                            -- [{ "rank", "title", "domain" }] les 3 premiers
  error text check (length(error) <= 500),
  demo boolean not null default false,
  checked_at timestamptz not null default now(),
  unique (keyword_id, week)
);
create index rank_checks_site_week_idx on public.rank_checks (site_id, week desc);
create index rank_checks_workspace_idx on public.rank_checks (workspace_id);
create trigger rank_checks_ws before insert or update on public.rank_checks
  for each row execute function public.check_site_workspace();

-- IndexNow : la clé du site (publique par nature : elle est aussi dans un fichier sur le site)
create table public.site_indexing (
  site_id uuid primary key references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  indexnow_key text not null default replace(gen_random_uuid()::text, '-', '') check (indexnow_key ~ '^[a-zA-Z0-9-]{8,128}$'),
  key_verified_at timestamptz,                   -- fichier de clé trouvé sur le site
  key_error text check (length(key_error) <= 300),
  auto_submit boolean not null default true,     -- signaler chaque article publié
  created_at timestamptz not null default now()
);
create index site_indexing_workspace_idx on public.site_indexing (workspace_id);
create trigger site_indexing_ws before insert or update on public.site_indexing
  for each row execute function public.check_site_workspace();

-- Journal des envois IndexNow
create table public.indexnow_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  urls text[] not null check (cardinality(urls) between 1 and 100),
  source text not null default 'manual' check (source in ('manual', 'article')),
  status_code smallint,
  ok boolean not null default false,
  error text check (length(error) <= 300),
  demo boolean not null default false,
  sent_at timestamptz not null default now()
);
create index indexnow_submissions_site_idx on public.indexnow_submissions (site_id, sent_at desc);
create index indexnow_submissions_workspace_idx on public.indexnow_submissions (workspace_id);
create trigger indexnow_submissions_ws before insert or update on public.indexnow_submissions
  for each row execute function public.check_site_workspace();

-- État d'indexation Google d'une page (dernière inspection)
create table public.url_inspections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  url text not null check (length(url) <= 2000),
  verdict text check (verdict in ('PASS', 'PARTIAL', 'FAIL', 'NEUTRAL', 'VERDICT_UNSPECIFIED')),
  coverage text check (length(coverage) <= 200),               -- ex. « Envoyée et indexée »
  indexing_state text check (length(indexing_state) <= 60),
  page_fetch text check (length(page_fetch) <= 60),
  robots text check (length(robots) <= 60),
  google_canonical text check (length(google_canonical) <= 2000),
  last_crawl_at timestamptz,
  error text check (length(error) <= 300),
  demo boolean not null default false,
  checked_at timestamptz not null default now(),
  unique (site_id, url)
);
create index url_inspections_workspace_idx on public.url_inspections (workspace_id);
create trigger url_inspections_ws before insert or update on public.url_inspections
  for each row execute function public.check_site_workspace();

-- Lecture : membres de l'espace. Écriture : serveur seulement.
alter table public.rank_keywords enable row level security;
alter table public.rank_checks enable row level security;
alter table public.site_indexing enable row level security;
alter table public.indexnow_submissions enable row level security;
alter table public.url_inspections enable row level security;
create policy rank_keywords_select on public.rank_keywords for select using (public.is_member(workspace_id));
create policy rank_checks_select on public.rank_checks for select using (public.is_member(workspace_id));
create policy site_indexing_select on public.site_indexing for select using (public.is_member(workspace_id));
create policy indexnow_submissions_select on public.indexnow_submissions for select using (public.is_member(workspace_id));
create policy url_inspections_select on public.url_inspections for select using (public.is_member(workspace_id));
revoke all on public.rank_keywords, public.rank_checks, public.site_indexing, public.indexnow_submissions, public.url_inspections from anon, authenticated;
grant select on public.rank_keywords, public.rank_checks, public.site_indexing, public.indexnow_submissions, public.url_inspections to authenticated;

-- Sites à mesurer cette semaine (tâche de fond, service_role) : site configuré, espace non suspendu,
-- abonnement actif ou essai en cours, offre avec les positions, et au moins un mot-clé sans mesure
-- de la semaine (un passage interrompu reprend là où il s'est arrêté).
create or replace function public.rank_due()
returns table (workspace_id uuid, site_id uuid, max_keywords int)
language sql stable security definer set search_path = public as $$
  select s.workspace_id, s.id, p.rank_keywords
    from public.sites s
    join public.workspaces w on w.id = s.workspace_id
    join public.subscriptions sub on sub.workspace_id = s.workspace_id
    join public.plans p on p.code = sub.plan_code
   where s.onboarding_step >= 8
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and p.rank_keywords > 0
     and exists (
       select 1 from public.rank_keywords k
        where k.site_id = s.id
          and not exists (
            select 1 from public.rank_checks c
             where c.keyword_id = k.id
               and c.week = date_trunc('week', now() at time zone 'Europe/Zurich')::date))
   order by s.created_at;
$$;
revoke execute on function public.rank_due() from public, anon, authenticated;
grant execute on function public.rank_due() to service_role;

-- Sites dont l'indexation Google peut être relue (Search Console connecté pour de vrai, abonnement en cours).
create or replace function public.indexing_due()
returns table (workspace_id uuid, site_id uuid)
language sql stable security definer set search_path = public as $$
  select s.workspace_id, s.id
    from public.sites s
    join public.workspaces w on w.id = s.workspace_id
    join public.subscriptions sub on sub.workspace_id = s.workspace_id
    join public.search_connections sc on sc.site_id = s.id
   where s.onboarding_step >= 8
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and not sc.demo and sc.credentials_enc is not null
   order by s.created_at;
$$;
revoke execute on function public.indexing_due() from public, anon, authenticated;
grant execute on function public.indexing_due() to service_role;
