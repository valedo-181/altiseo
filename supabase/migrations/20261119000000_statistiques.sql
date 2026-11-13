-- Statistiques de visites sans cookies (lot E). Un petit script sur le site du client envoie chaque
-- page vue ; le serveur Altiseo ne garde jamais l'adresse IP : il en tire une empreinte du jour
-- (HMAC avec un secret serveur + date), qui sert seulement à compter les visiteurs uniques du jour et
-- qui est effacée après deux jours. On garde des totaux par jour : visiteurs, pages vues, et le détail
-- par page, provenance, appareil et pays. Lecture pour les membres ; écriture par le serveur seulement.

create table public.site_analytics (
  site_id uuid primary key references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  site_key text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- public : dans le script du site
  enabled boolean not null default true,
  last_hit_at timestamptz,
  created_at timestamptz not null default now()
);
create index site_analytics_workspace_idx on public.site_analytics (workspace_id);
create trigger site_analytics_ws before insert or update on public.site_analytics
  for each row execute function public.check_site_workspace();

-- Totaux du jour (date de Zurich)
create table public.analytics_days (
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day date not null,
  visitors int not null default 0 check (visitors >= 0),
  pageviews int not null default 0 check (pageviews >= 0),
  primary key (site_id, day)
);
create index analytics_days_workspace_idx on public.analytics_days (workspace_id);

-- Détail du jour. page : pages vues ; source, device, country : visiteurs (à leur première page du jour).
create table public.analytics_dims (
  site_id uuid not null references public.sites (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('page', 'source', 'device', 'country')),
  value text not null check (length(value) between 1 and 300),
  visitors int not null default 0 check (visitors >= 0),
  pageviews int not null default 0 check (pageviews >= 0),
  primary key (site_id, day, kind, value)
);
create index analytics_dims_workspace_idx on public.analytics_dims (workspace_id);

-- Empreintes du jour (jamais lues par l'application ; effacées après deux jours)
create table public.analytics_seen (
  site_id uuid not null references public.sites (id) on delete cascade,
  day date not null,
  visitor text not null check (visitor ~ '^[0-9a-f]{32}$'),
  primary key (site_id, day, visitor)
);

alter table public.site_analytics enable row level security;
alter table public.analytics_days enable row level security;
alter table public.analytics_dims enable row level security;
alter table public.analytics_seen enable row level security;
create policy site_analytics_select on public.site_analytics for select using (public.is_member(workspace_id));
create policy analytics_days_select on public.analytics_days for select using (public.is_member(workspace_id));
create policy analytics_dims_select on public.analytics_dims for select using (public.is_member(workspace_id));
revoke all on public.site_analytics, public.analytics_days, public.analytics_dims, public.analytics_seen from anon, authenticated;
grant select on public.site_analytics, public.analytics_days, public.analytics_dims to authenticated;

-- Une page vue (appelée par le serveur, service_role). Rend false si la clé est inconnue, la mesure
-- arrêtée, l'abonnement fini, ou le plafond de 100 000 pages vues du jour atteint (protection).
create or replace function public.analytics_hit(p_key text, p_visitor text, p_path text, p_source text, p_device text, p_country text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  a record;
  d date := (now() at time zone 'Europe/Zurich')::date;
  fresh boolean;
begin
  select sa.site_id, sa.workspace_id into a
    from public.site_analytics sa
    join public.workspaces w on w.id = sa.workspace_id
    join public.subscriptions sub on sub.workspace_id = sa.workspace_id
   where sa.site_key = p_key and sa.enabled and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())));
  if a.site_id is null then return false; end if;
  if coalesce((select pageviews from public.analytics_days where site_id = a.site_id and day = d), 0) >= 100000 then return false; end if;

  insert into public.analytics_seen (site_id, day, visitor) values (a.site_id, d, p_visitor) on conflict do nothing;
  fresh := found;

  insert into public.analytics_days (site_id, workspace_id, day, visitors, pageviews)
  values (a.site_id, a.workspace_id, d, fresh::int, 1)
  on conflict (site_id, day) do update set visitors = analytics_days.visitors + excluded.visitors, pageviews = analytics_days.pageviews + 1;

  insert into public.analytics_dims (site_id, workspace_id, day, kind, value, visitors, pageviews)
  values (a.site_id, a.workspace_id, d, 'page', left(coalesce(nullif(p_path, ''), '/'), 300), fresh::int, 1)
  on conflict (site_id, day, kind, value) do update set visitors = analytics_dims.visitors + excluded.visitors, pageviews = analytics_dims.pageviews + 1;

  if fresh then
    insert into public.analytics_dims (site_id, workspace_id, day, kind, value, visitors, pageviews)
    select a.site_id, a.workspace_id, d, k, left(v, 300), 1, 0
      from (values ('source', coalesce(nullif(p_source, ''), 'Direct')), ('device', coalesce(nullif(p_device, ''), 'Ordinateur')),
                   ('country', coalesce(nullif(p_country, ''), '??'))) x (k, v)
    on conflict (site_id, day, kind, value) do update set visitors = analytics_dims.visitors + 1;
  end if;

  update public.site_analytics set last_hit_at = now()
   where site_id = a.site_id and (last_hit_at is null or last_hit_at < now() - interval '1 minute');
  return true;
end;
$$;
revoke execute on function public.analytics_hit(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.analytics_hit(text, text, text, text, text, text) to service_role;

-- Classement d'un détail sur une période (lu par la personne : la RLS s'applique). total = somme de
-- tout le détail, pour la part en %.
create or replace function public.analytics_top(p_site uuid, p_since date, p_kind text, p_limit int default 10)
returns table (value text, count bigint, total bigint)
language sql stable security invoker set search_path = public as $$
  select x.value, x.n, sum(x.n) over ()
    from (select d.value, sum(case when p_kind = 'page' then d.pageviews else d.visitors end) n
            from public.analytics_dims d
           where d.site_id = p_site and d.day >= p_since and d.kind = p_kind
           group by d.value) x
   order by x.n desc, x.value
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
revoke execute on function public.analytics_top(uuid, date, text, int) from public, anon;
grant execute on function public.analytics_top(uuid, date, text, int) to authenticated, service_role;

-- Ménage quotidien : empreintes de plus d'un jour, totaux de plus de 13 mois.
create or replace function public.analytics_purge()
returns void language sql security definer set search_path = public as $$
  delete from public.analytics_seen where day < (now() at time zone 'Europe/Zurich')::date - 1;
  delete from public.analytics_dims where day < (now() at time zone 'Europe/Zurich')::date - 400;
  delete from public.analytics_days where day < (now() at time zone 'Europe/Zurich')::date - 400;
$$;
revoke execute on function public.analytics_purge() from public, anon, authenticated;
grant execute on function public.analytics_purge() to service_role;

-- Chaque site a sa clé de mesure dès sa création (et les sites déjà là).
create or replace function public.sites_add_analytics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_analytics (site_id, workspace_id) values (new.id, new.workspace_id) on conflict (site_id) do nothing;
  return new;
end;
$$;
create trigger sites_add_analytics after insert on public.sites
  for each row execute function public.sites_add_analytics();
insert into public.site_analytics (site_id, workspace_id) select id, workspace_id from public.sites on conflict (site_id) do nothing;
