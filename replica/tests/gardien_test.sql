-- Gardien du site : un gardien par site créé d'office, lecture par les membres seulement, aucune
-- écriture côté navigateur, résumé du jour additionné, liste des sites à vérifier.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.ch'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-000000000001', 'A'), ('22222222-0000-0000-0000-000000000002', 'B');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner');
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('11111111-0000-0000-0000-000000000001', 'grow', 'active'), ('22222222-0000-0000-0000-000000000002', 'grow', 'canceled');
insert into public.sites (id, workspace_id, url, name, onboarding_step) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'https://a.ch', 'A', 8),
  ('b2222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'https://b.ch', 'B', 8);

do $$
declare n int; ok boolean; e text[];
begin
  -- 1. Gardien créé avec le site
  select count(*) into n from public.site_monitors where site_id in ('a1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002');
  if n <> 2 then raise exception 'ECHEC 1 : % gardiens au lieu de 2', n; end if;

  -- 2. À vérifier : A (abonnement actif) oui, B (résilié) non ; alerte au propriétaire par défaut
  select count(*) into n from public.monitor_due() d where d.site_id in ('a1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002');
  if n <> 1 then raise exception 'ECHEC 2 : % sites à vérifier au lieu de 1', n; end if;
  select d.emails into e from public.monitor_due() d where d.site_id in ('a1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002');
  if e <> array['a@test.ch'] then raise exception 'ECHEC 2 : adresses d''alerte %', e; end if;
  update public.site_monitors set alert_emails = '{alertes@a.ch}', last_checked_at = now() - interval '1 minute' where site_id = 'a1111111-0000-0000-0000-000000000001';
  select count(*) into n from public.monitor_due() d where d.site_id in ('a1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002');
  if n <> 0 then raise exception 'ECHEC 2 : vérifié il y a 1 minute, ne doit pas revenir'; end if;
  update public.site_monitors set last_checked_at = now() - interval '6 minutes' where site_id = 'a1111111-0000-0000-0000-000000000001';
  select d.emails into e from public.monitor_due() d where d.site_id in ('a1111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002');
  if e <> array['alertes@a.ch'] then raise exception 'ECHEC 2 : adresse du réglage ignorée'; end if;

  -- 3. Résumé du jour additionné
  perform public.monitor_add_day('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', current_date, false, 200);
  perform public.monitor_add_day('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', current_date, true, 0);
  select checks * 100 + failures into n from public.monitor_days where site_id = 'a1111111-0000-0000-0000-000000000001';
  if n <> 201 then raise exception 'ECHEC 3 : résumé du jour faux (%)', n; end if;

  -- 4. Une seule panne ouverte par site
  insert into public.monitor_incidents (site_id, workspace_id, started_at) values ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now());
  ok := false;
  begin insert into public.monitor_incidents (site_id, workspace_id, started_at) values ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now());
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : deux pannes ouvertes'; end if;

  -- 5. Le membre lit, n'écrit pas, n'appelle pas les fonctions du serveur
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  select count(*) into n from public.site_monitors;
  if n <> 1 then raise exception 'ECHEC 5 : le membre voit % gardiens', n; end if;
  select count(*) into n from public.monitor_incidents;
  if n <> 1 then raise exception 'ECHEC 5 : le membre ne voit pas sa panne'; end if;
  ok := false;
  begin update public.site_monitors set enabled = false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : un membre modifie le gardien'; end if;
  ok := false;
  begin perform public.monitor_add_day('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', current_date, false, 1); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : un membre appelle monitor_add_day'; end if;
  ok := false;
  begin perform * from public.monitor_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : un membre lit les adresses d''alerte de tous'; end if;

  -- 6. Un autre espace ne voit rien
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  select count(*) into n from public.monitor_incidents;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit la panne'; end if;
  select count(*) into n from public.monitor_days;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit le résumé'; end if;

  reset role;
  raise notice 'gardien_test : 6 contrôles réussis';
end $$;
rollback;
