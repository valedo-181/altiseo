-- Gardien du site (lot B) : le site de chaque client est vérifié toutes les 5 minutes ; on garde son
-- état, les pannes, un résumé par jour (pour la disponibilité sur 30 jours), l'échéance du certificat
-- SSL et du nom de domaine. Lecture pour les membres ; écriture par le serveur seulement.

create table public.site_monitors (
  site_id uuid primary key references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  enabled boolean not null default true,
  status text not null default 'unknown' check (status in ('unknown', 'up', 'down')),
  fails smallint not null default 0 check (fails >= 0),          -- échecs de suite
  last_checked_at timestamptz,
  last_status_code smallint,
  last_ms int,
  last_error text check (length(last_error) <= 300),
  down_since timestamptz,
  ssl_expires_at timestamptz,
  ssl_checked_at timestamptz,
  domain_expires_on date,
  domain_source text check (domain_source in ('rdap', 'manual')),
  domain_checked_at timestamptz,
  alert_emails text[] not null default '{}' check (cardinality(alert_emails) <= 3),
  alerts_sent jsonb not null default '{}',                       -- seuils déjà annoncés (SSL, domaine)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index site_monitors_workspace_idx on public.site_monitors (workspace_id);
create trigger site_monitors_ws before insert or update on public.site_monitors
  for each row execute function public.check_site_workspace();
create trigger site_monitors_touch before update on public.site_monitors
  for each row execute function public.touch_updated_at();

-- Résumé par jour (UTC) : nombre de vérifications, d'échecs et temps de réponse cumulé.
create table public.monitor_days (
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day date not null,
  checks int not null default 0 check (checks >= 0),
  failures int not null default 0 check (failures >= 0),
  total_ms bigint not null default 0,
  primary key (site_id, day)
);
create index monitor_days_workspace_idx on public.monitor_days (workspace_id);
create trigger monitor_days_ws before insert or update on public.monitor_days
  for each row execute function public.check_site_workspace();

-- Pannes : ouvertes après 2 échecs de suite, fermées au premier retour.
create table public.monitor_incidents (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  status_code smallint,
  error text check (length(error) <= 300),
  created_at timestamptz not null default now(),
  constraint incident_order check (ended_at is null or ended_at >= started_at)
);
create index monitor_incidents_site_idx on public.monitor_incidents (site_id, started_at desc);
create index monitor_incidents_workspace_idx on public.monitor_incidents (workspace_id);
create unique index monitor_incidents_open_idx on public.monitor_incidents (site_id) where ended_at is null;
create trigger monitor_incidents_ws before insert or update on public.monitor_incidents
  for each row execute function public.check_site_workspace();

alter table public.site_monitors enable row level security;
alter table public.monitor_days enable row level security;
alter table public.monitor_incidents enable row level security;
create policy site_monitors_select on public.site_monitors for select using (public.is_member(workspace_id));
create policy monitor_days_select on public.monitor_days for select using (public.is_member(workspace_id));
create policy monitor_incidents_select on public.monitor_incidents for select using (public.is_member(workspace_id));
revoke all on public.site_monitors, public.monitor_days, public.monitor_incidents from anon, authenticated;
grant select on public.site_monitors, public.monitor_days, public.monitor_incidents to authenticated;

-- Ajoute une vérification au résumé du jour, sans perdre de vérification si deux passages se croisent.
create or replace function public.monitor_add_day(p_site uuid, p_workspace uuid, p_day date, p_failed boolean, p_ms int)
returns void language sql security definer set search_path = public as $$
  insert into public.monitor_days (site_id, workspace_id, day, checks, failures, total_ms)
  values (p_site, p_workspace, p_day, 1, case when p_failed then 1 else 0 end, greatest(coalesce(p_ms, 0), 0))
  on conflict (site_id, day) do update
    set checks = monitor_days.checks + 1,
        failures = monitor_days.failures + excluded.failures,
        total_ms = monitor_days.total_ms + excluded.total_ms;
$$;
revoke execute on function public.monitor_add_day(uuid, uuid, date, boolean, int) from public, anon, authenticated;
grant execute on function public.monitor_add_day(uuid, uuid, date, boolean, int) to service_role;

-- Sites à vérifier (tâche de fond, service_role) : gardien actif, site configuré, espace non suspendu,
-- abonnement actif ou essai en cours, dernière vérification il y a plus de 4 minutes. Les adresses
-- d'alerte sont celles du réglage, sinon celles des propriétaires et administrateurs de l'espace.
create or replace function public.monitor_due()
returns table (workspace_id uuid, site_id uuid, url text, site_name text, status text, fails int,
               ssl_checked_at timestamptz, domain_checked_at timestamptz, domain_source text, emails text[])
language sql stable security definer set search_path = public as $$
  select m.workspace_id, m.site_id, s.url, coalesce(s.name, s.url), m.status, m.fails,
         m.ssl_checked_at, m.domain_checked_at, m.domain_source,
         case when cardinality(m.alert_emails) > 0 then m.alert_emails
              else array(select u.email::text from public.memberships ms join auth.users u on u.id = ms.user_id
                          where ms.workspace_id = m.workspace_id and ms.role in ('owner', 'admin') and u.email is not null
                          order by ms.created_at limit 3) end
    from public.site_monitors m
    join public.sites s on s.id = m.site_id
    join public.workspaces w on w.id = m.workspace_id
    join public.subscriptions sub on sub.workspace_id = m.workspace_id
   where m.enabled
     and s.onboarding_step >= 8
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and (m.last_checked_at is null or m.last_checked_at < now() - interval '4 minutes')
   order by m.last_checked_at nulls first;
$$;
revoke execute on function public.monitor_due() from public, anon, authenticated;
grant execute on function public.monitor_due() to service_role;

-- Chaque site a son gardien, actif dès sa création (et pour les sites déjà là).
create or replace function public.sites_add_monitor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_monitors (site_id, workspace_id) values (new.id, new.workspace_id) on conflict (site_id) do nothing;
  return new;
end;
$$;
create trigger sites_add_monitor after insert on public.sites
  for each row execute function public.sites_add_monitor();
insert into public.site_monitors (site_id, workspace_id) select id, workspace_id from public.sites on conflict (site_id) do nothing;
