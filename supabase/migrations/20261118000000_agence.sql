-- Offre Agence (lot D) : 25 sites dans un espace, rapport mensuel à la marque de l'agence, lien de
-- lecture seule pour chaque client final (sans compte), envoi du rapport chaque mois.
-- Lecture pour les membres de l'espace ; écriture par le serveur seulement (service_role).

-- 1. La nouvelle offre (prix proposés, hors TVA)
insert into public.plans (code, articles_per_month, languages, sites, price_month_cents, price_year_cents, ai_questions, ai_engines, rank_keywords)
values ('agence', 300, 4, 25, 69000, 621000, 30, '{chatgpt,gemini,perplexity,claude}', 100)
on conflict (code) do update set
  articles_per_month = excluded.articles_per_month, languages = excluded.languages, sites = excluded.sites,
  price_month_cents = excluded.price_month_cents, price_year_cents = excluded.price_year_cents,
  ai_questions = excluded.ai_questions, ai_engines = excluded.ai_engines, rank_keywords = excluded.rank_keywords;

-- 2. Nombre de sites par espace : vérifié par la base (Grow 1, Scale 3, Agence 25)
create or replace function public.sites_quota_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_s int;
  n int;
begin
  -- Personne d'un autre espace : on laisse la RLS refuser l'ajout (sans rien lui apprendre du quota).
  if auth.uid() is not null and not public.is_member(new.workspace_id) then return new; end if;
  select p.sites into max_s
    from public.subscriptions s join public.plans p on p.code = s.plan_code
   where s.workspace_id = new.workspace_id
   for update of s;                              -- verrou : deux ajouts en même temps passent l'un après l'autre
  if max_s is null then return new; end if;     -- espace en cours de création : l'abonnement d'essai suit
  select count(*) into n from public.sites where workspace_id = new.workspace_id;
  if n >= max_s then
    raise exception 'Nombre de sites de l''offre atteint' using errcode = 'Q0001';
  end if;
  return new;
end;
$$;
drop trigger if exists sites_quota on public.sites;
create trigger sites_quota before insert on public.sites
  for each row execute function public.sites_quota_guard();

-- 3. Marque de l'agence (en tête des rapports)
create table public.workspace_branding (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  agency_name text check (length(agency_name) <= 120),
  logo_url text check (logo_url is null or (logo_url ~ '^https://' and length(logo_url) <= 1000)),
  accent text check (accent is null or accent ~ '^#[0-9a-fA-F]{6}$'),
  contact text check (length(contact) <= 200),   -- ligne en bas du rapport : « Agence X · 032 … · info@… »
  updated_at timestamptz not null default now()
);
create trigger workspace_branding_touch before update on public.workspace_branding
  for each row execute function public.touch_updated_at();

-- 4. Rapport d'un site pour son client : lien secret, adresses qui le reçoivent chaque mois
create table public.site_reports (
  site_id uuid primary key references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  shared boolean not null default false,          -- le lien ne marche que si l'agence l'a activé
  client_name text check (length(client_name) <= 120),
  client_emails text[] not null default '{}' check (cardinality(client_emails) <= 3),
  monthly boolean not null default false,         -- envoi du lien le 1er du mois
  last_sent_month date,                           -- 1er jour du mois du dernier envoi
  created_at timestamptz not null default now()
);
create index site_reports_workspace_idx on public.site_reports (workspace_id);
create trigger site_reports_ws before insert or update on public.site_reports
  for each row execute function public.check_site_workspace();

alter table public.workspace_branding enable row level security;
alter table public.site_reports enable row level security;
create policy workspace_branding_select on public.workspace_branding for select using (public.is_member(workspace_id));
create policy site_reports_select on public.site_reports for select using (public.is_member(workspace_id));
revoke all on public.workspace_branding, public.site_reports from anon, authenticated;
grant select on public.workspace_branding, public.site_reports to authenticated;

-- Rapports à envoyer ce mois (tâche de fond, service_role) : envoi mensuel actif, lien partagé, au
-- moins une adresse, abonnement en cours, pas encore envoyé ce mois-ci.
create or replace function public.reports_due()
returns table (workspace_id uuid, site_id uuid, token text, client_name text, emails text[])
language sql stable security definer set search_path = public as $$
  select r.workspace_id, r.site_id, r.token, r.client_name, r.client_emails
    from public.site_reports r
    join public.workspaces w on w.id = r.workspace_id
    join public.subscriptions sub on sub.workspace_id = r.workspace_id
   where r.monthly and r.shared and cardinality(r.client_emails) > 0
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and (r.last_sent_month is null or r.last_sent_month < date_trunc('month', now() at time zone 'Europe/Zurich')::date);
$$;
revoke execute on function public.reports_due() from public, anon, authenticated;
grant execute on function public.reports_due() to service_role;
