-- Statistiques sans cookies : clé de mesure créée avec le site, comptage des visiteurs du jour,
-- détail par page/provenance/appareil/pays, clé inconnue ou mesure arrêtée refusées, lecture pour
-- les membres seulement, empreintes jamais lisibles, ménage.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000e1', 'sa@test.ch'), ('bbbbbbbb-0000-0000-0000-0000000000e2', 'sb@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-0000000000e1', 'SA'), ('22222222-0000-0000-0000-0000000000e2', 'SB');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-0000000000e1', 'owner'),
  ('22222222-0000-0000-0000-0000000000e2', 'bbbbbbbb-0000-0000-0000-0000000000e2', 'owner');
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('11111111-0000-0000-0000-0000000000e1', 'grow', 'active'), ('22222222-0000-0000-0000-0000000000e2', 'grow', 'active');
insert into public.sites (id, workspace_id, url, name, onboarding_step) values
  ('a1111111-0000-0000-0000-0000000000e1', '11111111-0000-0000-0000-0000000000e1', 'https://sa.ch', 'SA', 8),
  ('b2222222-0000-0000-0000-0000000000e2', '22222222-0000-0000-0000-0000000000e2', 'https://sb.ch', 'SB', 8);

do $$
declare n int; m int; ok boolean; k text; k2 text; v1 text := repeat('a', 32); v2 text := repeat('b', 32);
begin
  -- 1. Clé de mesure créée avec le site
  select site_key into k from public.site_analytics where site_id = 'a1111111-0000-0000-0000-0000000000e1';
  select site_key into k2 from public.site_analytics where site_id = 'b2222222-0000-0000-0000-0000000000e2';
  if k !~ '^[0-9a-f]{32}$' or k = k2 then raise exception 'ECHEC 1 : clé %', k; end if;

  -- 2. Deux visiteurs, trois pages vues : 2 visiteurs, 3 pages vues ; la provenance compte le visiteur une fois
  if not public.analytics_hit(k, v1, '/', 'Google', 'Téléphone', 'CH') then raise exception 'ECHEC 2 : page vue refusée'; end if;
  perform public.analytics_hit(k, v1, '/tarifs', 'Google', 'Téléphone', 'CH');
  perform public.analytics_hit(k, v2, '/', '', 'Ordinateur', 'FR');
  select visitors, pageviews into n, m from public.analytics_days where site_id = 'a1111111-0000-0000-0000-0000000000e1';
  if n <> 2 or m <> 3 then raise exception 'ECHEC 2 : % visiteurs, % pages vues', n, m; end if;
  select pageviews into n from public.analytics_dims where site_id = 'a1111111-0000-0000-0000-0000000000e1' and kind = 'page' and value = '/';
  if n <> 2 then raise exception 'ECHEC 2 : page / vue % fois', n; end if;
  select visitors into n from public.analytics_dims where site_id = 'a1111111-0000-0000-0000-0000000000e1' and kind = 'source' and value = 'Google';
  if n <> 1 then raise exception 'ECHEC 2 : Google compté % fois', n; end if;
  select visitors into n from public.analytics_dims where site_id = 'a1111111-0000-0000-0000-0000000000e1' and kind = 'source' and value = 'Direct';
  if n <> 1 then raise exception 'ECHEC 2 : Direct compté % fois', n; end if;
  if (select last_hit_at from public.site_analytics where site_key = k) is null then raise exception 'ECHEC 2 : dernière visite pas notée'; end if;

  -- 3. Clé inconnue, mesure arrêtée ou abonnement fini : refusé
  if public.analytics_hit(repeat('0', 32), v1, '/', '', '', '') then raise exception 'ECHEC 3 : clé inconnue acceptée'; end if;
  update public.site_analytics set enabled = false where site_key = k2;
  if public.analytics_hit(k2, v1, '/', '', '', '') then raise exception 'ECHEC 3 : mesure arrêtée acceptée'; end if;
  update public.site_analytics set enabled = true where site_key = k2;
  update public.subscriptions set status = 'canceled' where workspace_id = '22222222-0000-0000-0000-0000000000e2';
  if public.analytics_hit(k2, v1, '/', '', '', '') then raise exception 'ECHEC 3 : abonnement fini accepté'; end if;
  ok := false;
  begin perform public.analytics_hit(k, 'pas-une-empreinte', '/', '', '', ''); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 3 : empreinte mal formée acceptée'; end if;

  -- 4. Ménage : empreintes d'avant-hier effacées, celles du jour gardées
  insert into public.analytics_seen (site_id, day, visitor) values ('a1111111-0000-0000-0000-0000000000e1', current_date - 3, v2);
  perform public.analytics_purge();
  select count(*) into n from public.analytics_seen;
  if n <> 2 then raise exception 'ECHEC 4 : % empreintes après le ménage', n; end if;

  -- 5. Le membre lit ses chiffres et sa clé, rien d'autre ; pas d'écriture, pas d'empreintes, pas d'appel direct
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000e1', true);
  select count(*) into n from public.analytics_days;
  select count(*) into m from public.site_analytics;
  if n <> 1 or m <> 1 then raise exception 'ECHEC 5 : le membre voit % jours, % clés', n, m; end if;
  select count(*) into n from public.analytics_dims where site_id = 'b2222222-0000-0000-0000-0000000000e2';
  if n <> 0 then raise exception 'ECHEC 5 : chiffres d''un autre espace visibles'; end if;
  select count into n from public.analytics_top('a1111111-0000-0000-0000-0000000000e1', current_date - 30, 'page', 5) where value = '/';
  select total into m from public.analytics_top('a1111111-0000-0000-0000-0000000000e1', current_date - 30, 'page', 1);
  if n <> 2 or m <> 3 then raise exception 'ECHEC 5 : classement des pages % / %', n, m; end if;
  select count(*) into n from public.analytics_top('b2222222-0000-0000-0000-0000000000e2', current_date - 30, 'page', 5);
  if n <> 0 then raise exception 'ECHEC 5 : classement d''un autre espace visible'; end if;
  ok := false;
  begin perform * from public.analytics_seen; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : empreintes lisibles'; end if;
  ok := false;
  begin update public.analytics_days set visitors = 999; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : chiffres modifiables'; end if;
  ok := false;
  begin perform public.analytics_hit(k, v1, '/', '', '', ''); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : appel direct de analytics_hit'; end if;
  reset role;

  -- 6. Les visiteurs anonymes (clé publique du script) ne lisent rien
  set local role anon;
  ok := false;
  begin perform * from public.site_analytics; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : clés lisibles sans compte'; end if;
  reset role;
  raise notice 'statistiques_test : 6 contrôles passés';
end $$;
rollback;
