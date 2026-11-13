-- =====================================================================
-- Console super admin, suite : créer et supprimer un client, fiche détaillée avec note interne,
-- autres administrateurs. Comme le reste de la console : chaque fonction vérifie le droit
-- (compte listé + double authentification) et inscrit l'action au journal.
-- =====================================================================

-- Note interne sur un client : visible des administrateurs seulement
create table public.platform_notes (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  note text not null check (length(note) <= 4000),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.platform_notes enable row level security;    -- aucune règle : lu par admin_workspace_detail()

-- Qui a donné l'accès à la console, pour la page des administrateurs
alter table public.platform_admins add column added_by uuid;

-- ---------------------------------------------------------------------
-- Créer un client à la main
-- ---------------------------------------------------------------------
-- Le compte doit déjà exister dans auth.users (le serveur le crée juste avant, avec l'API d'administration).
create or replace function public.admin_create_workspace(owner_email text, ws_name text, plan text, trial_days int)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid; wid uuid; mail text := lower(trim(owner_email)); nm text := left(trim(coalesce(ws_name, '')), 120);
begin
  perform public._require_platform_admin();
  if nm = '' then raise exception 'Indiquez le nom de l''entreprise' using errcode = '22023'; end if;
  if not exists (select 1 from public.plans where code = plan and active) then raise exception 'Offre inconnue' using errcode = '22023'; end if;
  if trial_days is null or trial_days < 1 or trial_days > 90 then raise exception 'Essai entre 1 et 90 jours' using errcode = '22023'; end if;
  select id into uid from auth.users where lower(email) = mail limit 1;
  if uid is null then raise exception 'Aucun compte avec cette adresse' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if exists (select 1 from public.memberships where user_id = uid) then raise exception 'Cette adresse a déjà un espace' using errcode = '23505'; end if;
  insert into public.workspaces (name) values (nm) returning id into wid;
  insert into public.memberships (workspace_id, user_id, role) values (wid, uid, 'owner');
  insert into public.subscriptions (workspace_id, plan_code, status, trial_ends_at, current_period_start, current_period_end)
    values (wid, plan, 'trialing', now() + make_interval(days => trial_days), now(), now() + interval '1 month');
  perform public._audit(wid, 'create_workspace', jsonb_build_object('name', nm, 'email', mail, 'plan', plan, 'trial_days', trial_days));
  return wid;
end;
$$;

-- ---------------------------------------------------------------------
-- Supprimer un client, définitivement
-- ---------------------------------------------------------------------
-- Garde-fous : le nom doit être retapé à l'identique ; l'espace d'un administrateur ne se supprime pas.
-- Renvoie les comptes qui n'appartiennent plus à aucun espace (le serveur les efface ensuite).
create or replace function public.admin_delete_workspace(wid uuid, confirm_name text)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare nm text; members uuid[]; orphans uuid[]; counts jsonb;
begin
  perform public._require_platform_admin();
  select name into nm from public.workspaces where id = wid;
  if nm is null then raise exception 'Espace introuvable' using errcode = 'P0002'; end if;
  if trim(coalesce(confirm_name, '')) <> nm then raise exception 'Le nom saisi ne correspond pas' using errcode = '22023'; end if;
  if exists (select 1 from public.memberships m join public.platform_admins p on p.user_id = m.user_id where m.workspace_id = wid) then
    raise exception 'Cet espace appartient à un administrateur : il ne peut pas être supprimé ici' using errcode = '42501';
  end if;
  select array_agg(user_id) into members from public.memberships where workspace_id = wid;
  select jsonb_build_object(
    'sites', (select count(*) from public.sites where workspace_id = wid),
    'articles', (select count(*) from public.articles where workspace_id = wid)) into counts;
  delete from public.workspaces where id = wid;                 -- tout le reste suit (on delete cascade)
  select coalesce(array_agg(u), '{}') into orphans from unnest(coalesce(members, '{}')) u
   where not exists (select 1 from public.memberships m where m.user_id = u)
     and not exists (select 1 from public.platform_admins p where p.user_id = u);
  perform public._audit(null, 'delete_workspace', jsonb_build_object('id', wid, 'name', nm) || counts);
  return orphans;
end;
$$;

-- ---------------------------------------------------------------------
-- Fiche détaillée d'un client
-- ---------------------------------------------------------------------
create or replace function public.admin_workspace_detail(wid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  if not exists (select 1 from public.workspaces where id = wid) then raise exception 'Espace introuvable' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'members', (select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'role', m.role, 'last_sign_in', u.last_sign_in_at, 'joined', m.created_at) order by m.created_at), '[]')
                  from public.memberships m join auth.users u on u.id = m.user_id where m.workspace_id = wid),
    'sites', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', s.id, 'name', s.name, 'url', s.url, 'configured', s.onboarding_step >= 8, 'language', s.language, 'publish_mode', s.publish_mode,
                 'integration', (select i.kind from public.integrations i where i.site_id = s.id and i.status <> 'disabled' limit 1),
                 'integration_simulated', coalesce((select i.demo from public.integrations i where i.site_id = s.id and i.status <> 'disabled' limit 1), false),
                 'articles', (select count(*) from public.articles a where a.site_id = s.id),
                 'published', (select count(*) from public.articles a where a.site_id = s.id and a.status = 'published'),
                 'topics_approved', (select count(*) from public.calendar_items c where c.site_id = s.id and c.status = 'approved')) order by s.created_at), '[]')
                from public.sites s where s.workspace_id = wid),
    'usage', jsonb_build_object(
      'images', (select count(*) from public.articles a where a.workspace_id = wid and a.image_url is not null and not a.image_demo),
      'ads', (select count(*) from public.ad_drafts d where d.workspace_id = wid),
      'ads_approved', (select count(*) from public.ad_drafts d where d.workspace_id = wid and d.status = 'approved'),
      'rank_keywords', (select count(*) from public.rank_keywords k where k.workspace_id = wid),
      'ai_questions', (select count(*) from public.ai_questions q where q.workspace_id = wid),
      'search_connected', exists (select 1 from public.search_connections c where c.workspace_id = wid and not c.demo)),
    'note', (select n.note from public.platform_notes n where n.workspace_id = wid),
    'note_at', (select n.updated_at from public.platform_notes n where n.workspace_id = wid));
end;
$$;

create or replace function public.admin_set_note(wid uuid, body text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := left(trim(coalesce(body, '')), 4000);
begin
  perform public._require_platform_admin();
  if not exists (select 1 from public.workspaces where id = wid) then raise exception 'Espace introuvable' using errcode = 'P0002'; end if;
  if t = '' then delete from public.platform_notes where workspace_id = wid;
  else
    insert into public.platform_notes (workspace_id, note, updated_by) values (wid, t, auth.uid())
    on conflict (workspace_id) do update set note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
  end if;
  perform public._audit(wid, 'set_note', jsonb_build_object('length', length(t)));   -- le texte de la note ne va pas au journal
end;
$$;

-- ---------------------------------------------------------------------
-- Autres administrateurs
-- ---------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, added_at timestamptz, added_by_email text, last_sign_in timestamptz, mfa_ready boolean, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_platform_admin();
  return query
  select p.user_id, u.email::text, p.created_at, b.email::text, u.last_sign_in_at,
         exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified'),
         p.user_id = auth.uid()
    from public.platform_admins p
    left join auth.users u on u.id = p.user_id
    left join auth.users b on b.id = p.added_by
   order by p.created_at;
end;
$$;

-- La personne doit déjà avoir un compte ; elle configurera sa propre double authentification à sa première visite.
create or replace function public.admin_add_admin(admin_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid; mail text := lower(trim(admin_email));
begin
  perform public._require_platform_admin();
  select id into uid from auth.users where lower(email) = mail limit 1;
  if uid is null then raise exception 'Aucun compte avec cette adresse : la personne doit d''abord se connecter une fois à Altiseo' using errcode = 'P0002'; end if;
  if exists (select 1 from public.platform_admins where user_id = uid) then raise exception 'Cette personne est déjà administratrice' using errcode = '23505'; end if;
  if (select count(*) from public.platform_admins) >= 10 then raise exception 'Dix administrateurs au plus' using errcode = '22023'; end if;
  insert into public.platform_admins (user_id, added_by) values (uid, auth.uid());
  perform public._audit(null, 'add_admin', jsonb_build_object('email', mail));
end;
$$;

-- On ne se retire pas soi-même : il reste donc toujours au moins un administrateur.
create or replace function public.admin_remove_admin(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  perform public._require_platform_admin();
  if uid = auth.uid() then raise exception 'Vous ne pouvez pas retirer votre propre accès' using errcode = '22023'; end if;
  select u.email into mail from public.platform_admins p left join auth.users u on u.id = p.user_id where p.user_id = uid;
  delete from public.platform_admins where user_id = uid;
  if not found then raise exception 'Administrateur introuvable' using errcode = 'P0002'; end if;
  perform public._audit(null, 'remove_admin', jsonb_build_object('email', mail));
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_create_workspace(text, text, text, int)', 'public.admin_delete_workspace(uuid, text)',
    'public.admin_workspace_detail(uuid)', 'public.admin_set_note(uuid, text)',
    'public.admin_list_admins()', 'public.admin_add_admin(text)', 'public.admin_remove_admin(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
