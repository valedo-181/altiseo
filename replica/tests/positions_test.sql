-- Positions et indexation : quota de mots-clés, une mesure par mot-clé et par semaine, liste des sites
-- à mesurer, lecture par les membres seulement, aucune écriture côté navigateur.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000c1', 'pa@test.ch'), ('bbbbbbbb-0000-0000-0000-0000000000c2', 'pb@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-0000000000c1', 'PA'), ('22222222-0000-0000-0000-0000000000c2', 'PB');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'owner'),
  ('22222222-0000-0000-0000-0000000000c2', 'bbbbbbbb-0000-0000-0000-0000000000c2', 'owner');
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('11111111-0000-0000-0000-0000000000c1', 'grow', 'active'), ('22222222-0000-0000-0000-0000000000c2', 'grow', 'canceled');
insert into public.sites (id, workspace_id, url, name, onboarding_step) values
  ('a1111111-0000-0000-0000-0000000000c1', '11111111-0000-0000-0000-0000000000c1', 'https://pa.ch', 'PA', 8),
  ('b2222222-0000-0000-0000-0000000000c2', '22222222-0000-0000-0000-0000000000c2', 'https://pb.ch', 'PB', 8);

do $$
declare n int; ok boolean; kid uuid; wk date := date_trunc('week', now() at time zone 'Europe/Zurich')::date; k text;
begin
  -- 1. Quotas des offres
  select rank_keywords into n from public.plans where code = 'grow';
  if n <> 50 then raise exception 'ECHEC 1 : grow suit % mots-clés', n; end if;
  select rank_keywords into n from public.plans where code = 'scale';
  if n <> 200 then raise exception 'ECHEC 1 : scale suit % mots-clés', n; end if;

  -- 2. Quota vérifié par la base (Q0001 au 51e) ; abonnement résilié : refus (Q0002)
  insert into public.rank_keywords (workspace_id, site_id, phrase)
    select '11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', 'mot ' || i from generate_series(1, 50) i;
  ok := false;
  begin insert into public.rank_keywords (workspace_id, site_id, phrase) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', 'de trop');
  exception when sqlstate 'Q0001' then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : quota de mots-clés dépassé'; end if;
  ok := false;
  begin insert into public.rank_keywords (workspace_id, site_id, phrase) values ('22222222-0000-0000-0000-0000000000c2', 'b2222222-0000-0000-0000-0000000000c2', 'x');
  exception when sqlstate 'Q0002' then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : mot-clé ajouté sans abonnement'; end if;
  -- doublon (citext : majuscules ignorées)
  ok := false;
  delete from public.rank_keywords where phrase = 'mot 50';
  begin insert into public.rank_keywords (workspace_id, site_id, phrase) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', 'MOT 1');
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : doublon accepté'; end if;

  -- 3. À mesurer : PA oui, puis non quand chaque mot-clé a sa mesure de la semaine
  select count(*) into n from public.rank_due() d where d.site_id = 'a1111111-0000-0000-0000-0000000000c1';
  if n <> 1 then raise exception 'ECHEC 3 : PA pas à mesurer'; end if;
  insert into public.rank_checks (workspace_id, site_id, keyword_id, week, position)
    select workspace_id, site_id, id, wk, 5 from public.rank_keywords where site_id = 'a1111111-0000-0000-0000-0000000000c1';
  select count(*) into n from public.rank_due() d where d.site_id = 'a1111111-0000-0000-0000-0000000000c1';
  if n <> 0 then raise exception 'ECHEC 3 : PA déjà mesuré revient'; end if;

  -- 4. Une mesure par mot-clé et par semaine ; la semaine doit être un lundi
  select id into kid from public.rank_keywords where phrase = 'mot 1';
  ok := false;
  begin insert into public.rank_checks (workspace_id, site_id, keyword_id, week) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', kid, wk);
  exception when unique_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : deux mesures la même semaine'; end if;
  ok := false;
  begin insert into public.rank_checks (workspace_id, site_id, keyword_id, week) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', kid, wk + 1);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : semaine qui ne commence pas un lundi'; end if;

  -- 5. Clé IndexNow créée d'office, au bon format
  insert into public.site_indexing (site_id, workspace_id) values ('a1111111-0000-0000-0000-0000000000c1', '11111111-0000-0000-0000-0000000000c1');
  select indexnow_key into k from public.site_indexing where site_id = 'a1111111-0000-0000-0000-0000000000c1';
  if k !~ '^[0-9a-f]{32}$' then raise exception 'ECHEC 5 : clé IndexNow %', k; end if;
  insert into public.url_inspections (workspace_id, site_id, url, verdict) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', 'https://pa.ch/', 'PASS');

  -- 6. Le membre lit, n'écrit pas, n'appelle pas les fonctions du serveur ; l'autre espace ne voit rien
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000c1', true);
  select count(*) into n from public.rank_keywords;
  if n <> 49 then raise exception 'ECHEC 6 : le membre voit % mots-clés', n; end if;
  select count(*) into n from public.site_indexing;
  if n <> 1 then raise exception 'ECHEC 6 : le membre ne voit pas sa clé'; end if;
  ok := false;
  begin insert into public.rank_keywords (workspace_id, site_id, phrase) values ('11111111-0000-0000-0000-0000000000c1', 'a1111111-0000-0000-0000-0000000000c1', 'navigateur'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre ajoute un mot-clé directement'; end if;
  ok := false;
  begin update public.site_indexing set indexnow_key = 'abcdefgh1234'; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre change la clé'; end if;
  ok := false;
  begin perform * from public.rank_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre appelle rank_due'; end if;
  ok := false;
  begin perform * from public.indexing_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre appelle indexing_due'; end if;
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000c2', true);
  select count(*) into n from public.rank_checks;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit les positions'; end if;
  select count(*) into n from public.url_inspections;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit l''indexation'; end if;

  reset role;
  raise notice 'positions_test : 6 contrôles réussis';
end $$;
rollback;
