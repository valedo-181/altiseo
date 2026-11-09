-- Durcissement après les contrôles de Supabase (security / performance advisors).

-- 1. Quota : le calcul brut devient interne ; la version publique ne répond qu'aux membres de l'espace
--    (sinon n'importe quel compte pourrait lire le nombre d'articles d'un autre espace).
create or replace function public._articles_left(wid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(p.articles_per_month), 0)
         - (select count(*) from public.articles a
             where a.workspace_id = wid and a.counted_in_period = s.current_period_start::date)::int
    from public.subscriptions s join public.plans p on p.code = s.plan_code
   where s.workspace_id = wid and s.status in ('trialing', 'active')
   group by s.current_period_start;
$$;

create or replace function public.articles_left(wid uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_member(wid) then public._articles_left(wid) end;
$$;

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
   for update;
  if period is null then
    raise exception 'Aucun abonnement actif' using errcode = 'Q0002';
  end if;
  new.counted_in_period := period;
  if coalesce(public._articles_left(new.workspace_id), 0) <= 0 then
    raise exception 'Quota d''articles atteint pour ce mois' using errcode = 'Q0001';
  end if;
  return new;
end;
$$;

-- 2. Fonction inutilisée : retirée.
drop function if exists public.create_workspace(text);

-- 3. Droits d'exécution : rien pour les visiteurs non connectés ; fonctions de déclencheur et calcul
--    interne pour personne (un déclencheur s'exécute sans ce droit).
revoke execute on function public._articles_left(uuid) from public, anon, authenticated;
revoke execute on function public.articles_quota_guard() from public, anon, authenticated;
revoke execute on function public.check_site_workspace() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.articles_left(uuid) from public, anon;
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.articles_left(uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- 4. search_path fixé.
alter function public.touch_updated_at() set search_path = public;

-- 5. Membres : une seule règle de lecture ; les admins gèrent par insert / update / delete.
drop policy if exists memberships_admin on public.memberships;
create policy memberships_insert on public.memberships for insert with check (public.is_admin(workspace_id));
create policy memberships_update on public.memberships for update using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));
create policy memberships_delete on public.memberships for delete using (public.is_admin(workspace_id));

-- 6. Index sur la clé étrangère des offres.
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_code);
