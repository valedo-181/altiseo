-- Visibilité IA (lot A) : chaque semaine, les questions des clients sont posées aux IA (ChatGPT, Gemini,
-- Perplexity, Claude) ; on garde pour chaque réponse si le site est cité, à quelle place, et quels
-- concurrents le sont. Lecture pour les membres de l'espace ; écriture par le serveur seulement
-- (service_role), après vérification du site.

-- Ce que chaque offre comprend : nombre de questions par site et IA interrogées.
alter table public.plans
  add column ai_questions int not null default 0 check (ai_questions between 0 and 500),
  add column ai_engines text[] not null default '{}'
    check (ai_engines <@ array['chatgpt', 'gemini', 'perplexity', 'claude']::text[]);
update public.plans set ai_questions = 10, ai_engines = '{chatgpt,perplexity}' where code = 'grow';
update public.plans set ai_questions = 30, ai_engines = '{chatgpt,gemini,perplexity,claude}' where code = 'scale';

-- Questions suivies, par site
create table public.ai_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  question text not null check (length(question) between 5 and 300),
  source text not null default 'manual' check (source in ('suggested', 'manual')),
  created_at timestamptz not null default now(),
  unique (site_id, question)
);
create index ai_questions_workspace_idx on public.ai_questions (workspace_id);
create trigger ai_questions_ws before insert or update on public.ai_questions
  for each row execute function public.check_site_workspace();

-- Quota : pas plus de questions par site que l'offre n'en compte (vérifié dans la base).
create or replace function public.ai_questions_quota_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_q int;
  n int;
begin
  select p.ai_questions into max_q
    from public.subscriptions s join public.plans p on p.code = s.plan_code
   where s.workspace_id = new.workspace_id and s.status in ('trialing', 'active')
   for update of s;                              -- verrou : deux ajouts en même temps passent l'un après l'autre
  if max_q is null then
    raise exception 'Aucun abonnement actif' using errcode = 'Q0002';
  end if;
  select count(*) into n from public.ai_questions where site_id = new.site_id;
  if n >= max_q then
    raise exception 'Quota de questions atteint' using errcode = 'Q0001';
  end if;
  return new;
end;
$$;
create trigger ai_questions_quota before insert on public.ai_questions
  for each row execute function public.ai_questions_quota_guard();

-- Passage de la semaine pour un site (un seul par semaine) ; garde aussi la
-- « préparation IA » du site (robots.txt, llms.txt, FAQ…).
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  week date not null check (extract(isodow from week) = 1),   -- lundi de la semaine
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  readiness jsonb,
  error text check (length(error) <= 500),
  demo boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (site_id, week)
);
create index ai_runs_workspace_idx on public.ai_runs (workspace_id);
create trigger ai_runs_ws before insert or update on public.ai_runs
  for each row execute function public.check_site_workspace();

-- Une réponse d'une IA à une question, pour une semaine
create table public.ai_checks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  question_id uuid not null references public.ai_questions (id) on delete cascade,
  engine text not null check (engine in ('chatgpt', 'gemini', 'perplexity', 'claude')),
  week date not null check (extract(isodow from week) = 1),
  status text not null default 'ok' check (status in ('ok', 'error')),
  cited boolean not null default false,          -- le nom ou le domaine du site apparaît dans la réponse
  position smallint check (position between 1 and 50),  -- place parmi les entreprises nommées
  linked boolean not null default false,         -- le site est dans les sources citées
  competitors jsonb not null default '[]',       -- [{ "name": …, "domain": … }] nommés dans la réponse
  sources jsonb not null default '[]',           -- adresses citées par l'IA (20 au plus)
  excerpt text check (length(excerpt) <= 1500),
  error text check (length(error) <= 500),
  demo boolean not null default false,
  checked_at timestamptz not null default now(),
  unique (question_id, engine, week)
);
create index ai_checks_site_week_idx on public.ai_checks (site_id, week desc);
create index ai_checks_workspace_idx on public.ai_checks (workspace_id);
create trigger ai_checks_ws before insert or update on public.ai_checks
  for each row execute function public.check_site_workspace();

-- Lecture : membres de l'espace. Écriture : serveur seulement.
alter table public.ai_questions enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_checks enable row level security;
create policy ai_questions_select on public.ai_questions for select using (public.is_member(workspace_id));
create policy ai_runs_select on public.ai_runs for select using (public.is_member(workspace_id));
create policy ai_checks_select on public.ai_checks for select using (public.is_member(workspace_id));
revoke all on public.ai_questions, public.ai_runs, public.ai_checks from anon, authenticated;
grant select on public.ai_questions, public.ai_runs, public.ai_checks to authenticated;

-- Sites à interroger cette semaine (tâche de fond, service_role) : site configuré, espace non suspendu,
-- abonnement actif ou essai en cours, offre avec la visibilité IA, au moins une question, et pas encore
-- de passage terminé cette semaine (un passage « en cours » est repris là où il s'est arrêté : seules les
-- questions sans réponse de la semaine sont posées).
create or replace function public.ai_visibility_due()
returns table (workspace_id uuid, site_id uuid, max_questions int, engines text[])
language sql stable security definer set search_path = public as $$
  select s.workspace_id, s.id, p.ai_questions, p.ai_engines
    from public.sites s
    join public.workspaces w on w.id = s.workspace_id
    join public.subscriptions sub on sub.workspace_id = s.workspace_id
    join public.plans p on p.code = sub.plan_code
   where s.onboarding_step >= 8
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and p.ai_questions > 0
     and exists (select 1 from public.ai_questions q where q.site_id = s.id)
     and not exists (
       select 1 from public.ai_runs r
        where r.site_id = s.id
          and r.week = date_trunc('week', now() at time zone 'Europe/Zurich')::date
          and r.status in ('done', 'error'))
   order by s.created_at;
$$;
revoke execute on function public.ai_visibility_due() from public, anon, authenticated;
grant execute on function public.ai_visibility_due() to service_role;
