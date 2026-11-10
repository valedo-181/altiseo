-- =====================================================================
-- Altiseo · console super admin (propriétaire de la plateforme)
-- Réservée aux comptes listés dans platform_admins ET connectés avec la double authentification
-- (aal2). Toutes les lectures et actions passent par les fonctions ci-dessous, qui le vérifient à
-- chaque appel ; chaque action est inscrite au journal (platform_audit).
-- Un espace suspendu ne donne plus aucun droit à ses membres (is_member / is_admin).
-- =====================================================================

create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;   -- aucune règle : illisible depuis l'API

alter table public.workspaces
  add column suspended_at     timestamptz,
  add column suspended_reason text check (suspended_reason is null or length(suspended_reason) <= 300);

create table public.platform_audit (
  id           bigint generated always as identity primary key,
  admin_id     uuid not null,
  workspace_id uuid,
  action       text not null,
  data         jsonb,
  at           timestamptz not null default now()
);
create index platform_audit_ws_idx on public.platform_audit (workspace_id, at desc);
create index platform_audit_at_idx on public.platform_audit (at desc);
alter table public.platform_audit enable row level security;    -- aucune règle : lu par admin_journal()

-- Accès des clients : un espace suspendu ne donne plus aucun droit
create or replace function public.is_member(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.workspaces w on w.id = m.workspace_id
     where m.workspace_id = wid and m.user_id = auth.uid() and w.suspended_at is null);
$$;

create or replace function public.is_admin(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m join public.workspaces w on w.id = m.workspace_id
     where m.workspace_id = wid and m.user_id = auth.uid() and m.role in ('owner', 'admin') and w.suspended_at is null);
$$;

-- Pour afficher « compte suspendu » au client concerné
create or replace function public.my_suspension()
returns table (name text, reason text)
language sql stable security definer set search_path = public as $$
  select w.name, w.suspended_reason
    from public.memberships m join public.workspaces w on w.id = m.workspace_id
   where m.user_id = auth.uid() and w.suspended_at is not null
   order by m.created_at limit 1;
$$;

-- ---------------------------------------------------------------------
-- Super admin : statut et garde
-- ---------------------------------------------------------------------
create or replace function public.platform_admin_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listed', exists (select 1 from public.platform_admins p where p.user_id = auth.uid()),
    'aal2', coalesce(auth.jwt() ->> 'aal', '') = 'aal2');
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins p where p.user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function public._require_platform_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Réservé au super admin (double authentification)' using errcode = '42501'; end if;
end;
$$;

create or replace function public._audit(wid uuid, act text, d jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.platform_audit (admin_id, workspace_id, action, data) values (auth.uid(), wid, act, d);
$$;

-- ---------------------------------------------------------------------
-- Lectures
-- ---------------------------------------------------------------------

-- Tous les espaces, avec ce qu'il faut pour la liste, les coûts et la santé
create or replace function public.admin_workspaces()
returns table (
  id uuid, name text, created_at timestamptz, suspended_at timestamptz, suspended_reason text,
  owner_email text, owner_last_sign_in timestamptz,
  plan_code text, sub_status text, trial_ends_at timestamptz, period_start timestamptz,
  price_month_cents int, articles_per_month int,
  sites int, site_url text,
  articles_period int, articles_30d int, articles_total int,
  ai_cost_period_micro bigint, ai_cost_30d_micro bigint, ai_cost_total_micro bigint,
  failed_items int, last_article_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  return query
  select w.id, w.name, w.created_at, w.suspended_at, w.suspended_reason,
         o.email::text, o.last_sign_in_at,
         s.plan_code, s.status, s.trial_ends_at, s.current_period_start,
         p.price_month_cents, p.articles_per_month,
         (select count(*)::int from public.sites x where x.workspace_id = w.id),
         (select x.url from public.sites x where x.workspace_id = w.id order by x.created_at limit 1),
         (select count(*)::int from public.articles a where a.workspace_id = w.id and a.counted_in_period = s.current_period_start::date),
         (select count(*)::int from public.articles a where a.workspace_id = w.id and a.created_at > now() - interval '30 days'),
         (select count(*)::int from public.articles a where a.workspace_id = w.id),
         (select coalesce(sum(a.ai_cost_micro_usd), 0)::bigint from public.articles a where a.workspace_id = w.id and a.created_at >= s.current_period_start),
         (select coalesce(sum(a.ai_cost_micro_usd), 0)::bigint from public.articles a where a.workspace_id = w.id and a.created_at > now() - interval '30 days'),
         (select coalesce(sum(a.ai_cost_micro_usd), 0)::bigint from public.articles a where a.workspace_id = w.id),
         ((select count(*) from public.publications u where u.workspace_id = w.id and u.status = 'error')
          + (select count(*) from public.calendar_items c where c.workspace_id = w.id and c.status = 'failed')
          + (select count(*) from public.jobs j where j.workspace_id = w.id and j.status in ('failed', 'dead')))::int,
         (select max(a.created_at) from public.articles a where a.workspace_id = w.id)
    from public.workspaces w
    left join public.subscriptions s on s.workspace_id = w.id
    left join public.plans p on p.code = s.plan_code
    left join lateral (
      select u.email, u.last_sign_in_at from public.memberships m join auth.users u on u.id = m.user_id
       where m.workspace_id = w.id and m.role = 'owner' order by m.created_at limit 1) o on true
   order by w.created_at desc;
end;
$$;

-- Ce qui a échoué : publications refusées, sujets en échec, tâches bloquées
create or replace function public.admin_failures()
returns table (kind text, id text, workspace_id uuid, workspace_name text, label text, error text, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  return query
  select * from (
    select 'publication'::text, u.id::text, u.workspace_id, w.name, a.title, u.last_error, coalesce(u.last_attempt_at, u.updated_at)
      from public.publications u join public.articles a on a.id = u.article_id join public.workspaces w on w.id = u.workspace_id
     where u.status = 'error'
    union all
    select 'topic', c.id::text, c.workspace_id, w.name, c.title, null::text, c.updated_at
      from public.calendar_items c join public.workspaces w on w.id = c.workspace_id
     where c.status = 'failed'
    union all
    select 'job', j.id::text, j.workspace_id, w.name, j.kind, j.last_error, j.updated_at
      from public.jobs j left join public.workspaces w on w.id = j.workspace_id
     where j.status in ('failed', 'dead')
  ) f order by 7 desc limit 200;
end;
$$;

create or replace function public.admin_journal(wid uuid default null, lim int default 200)
returns table (at timestamptz, admin_email text, workspace_id uuid, workspace_name text, action text, data jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  return query
  select l.at, u.email::text, l.workspace_id, w.name, l.action, l.data
    from public.platform_audit l
    left join auth.users u on u.id = l.admin_id
    left join public.workspaces w on w.id = l.workspace_id
   where wid is null or l.workspace_id = wid
   order by l.at desc limit least(greatest(lim, 1), 500);
end;
$$;

-- ---------------------------------------------------------------------
-- Actions (chacune journalisée)
-- ---------------------------------------------------------------------

create or replace function public.admin_suspend(wid uuid, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  if coalesce(trim(reason), '') = '' then raise exception 'Indiquez la raison de la suspension' using errcode = '22023'; end if;
  update public.workspaces set suspended_at = now(), suspended_reason = left(trim(reason), 300) where id = wid and suspended_at is null;
  if not found then raise exception 'Espace introuvable ou déjà suspendu' using errcode = 'P0002'; end if;
  perform public._audit(wid, 'suspend', jsonb_build_object('reason', left(trim(reason), 300)));
end;
$$;

create or replace function public.admin_unsuspend(wid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  update public.workspaces set suspended_at = null, suspended_reason = null where id = wid and suspended_at is not null;
  if not found then raise exception 'Espace introuvable ou non suspendu' using errcode = 'P0002'; end if;
  perform public._audit(wid, 'unsuspend', null);
end;
$$;

create or replace function public.admin_extend_trial(wid uuid, days int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare ends timestamptz;
begin
  perform public._require_platform_admin();
  if days is null or days < 1 or days > 90 then raise exception 'Entre 1 et 90 jours' using errcode = '22023'; end if;
  update public.subscriptions
     set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => days), status = 'trialing'
   where workspace_id = wid and status in ('trialing', 'canceled', 'incomplete')
   returning trial_ends_at into ends;
  if ends is null then raise exception 'Pas d''essai à prolonger (abonnement payant ?)' using errcode = 'P0002'; end if;
  perform public._audit(wid, 'extend_trial', jsonb_build_object('days', days, 'until', ends));
  return ends;
end;
$$;

create or replace function public.admin_set_plan(wid uuid, plan text)
returns void language plpgsql security definer set search_path = public as $$
declare old text;
begin
  perform public._require_platform_admin();
  if not exists (select 1 from public.plans where code = plan and active) then raise exception 'Offre inconnue' using errcode = '22023'; end if;
  select plan_code into old from public.subscriptions where workspace_id = wid;
  if old is null then raise exception 'Espace sans abonnement' using errcode = 'P0002'; end if;
  if old = plan then return; end if;
  update public.subscriptions set plan_code = plan where workspace_id = wid;
  perform public._audit(wid, 'set_plan', jsonb_build_object('from', old, 'to', plan));
end;
$$;

-- Relancer : une tâche bloquée repart de zéro ; un sujet en échec redevient « approuvé »
create or replace function public.admin_retry(kind text, item_id text)
returns void language plpgsql security definer set search_path = public as $$
declare wid uuid;
begin
  perform public._require_platform_admin();
  if kind = 'job' then
    update public.jobs set status = 'queued', attempts = 0, run_at = now(), locked_until = null, last_error = null
     where id = item_id::uuid and status in ('failed', 'dead') returning workspace_id into wid;
  elsif kind = 'topic' then
    update public.calendar_items set status = 'approved' where id = item_id::uuid and status = 'failed' returning workspace_id into wid;
  else
    raise exception 'Relance impossible pour ce type' using errcode = '22023';
  end if;
  if not found then raise exception 'Élément introuvable ou déjà relancé' using errcode = 'P0002'; end if;
  perform public._audit(wid, 'retry_' || kind, jsonb_build_object('id', item_id));
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public._require_platform_admin() from public, anon, authenticated;
revoke execute on function public._audit(uuid, text, jsonb) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.my_suspension()', 'public.platform_admin_status()', 'public.is_platform_admin()',
    'public.admin_workspaces()', 'public.admin_failures()', 'public.admin_journal(uuid, int)',
    'public.admin_suspend(uuid, text)', 'public.admin_unsuspend(uuid)', 'public.admin_extend_trial(uuid, int)',
    'public.admin_set_plan(uuid, text)', 'public.admin_retry(text, text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
