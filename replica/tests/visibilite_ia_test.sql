-- Visibilité IA : lecture par les membres seulement, aucune écriture côté navigateur, quota de questions
-- de l'offre, liste des sites à interroger cette semaine.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.ch'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-000000000001', 'A'), ('22222222-0000-0000-0000-000000000002', 'B');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner');
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('11111111-0000-0000-0000-000000000001', 'grow', 'active'), ('22222222-0000-0000-0000-000000000002', 'scale', 'active');
insert into public.sites (id, workspace_id, url, name, onboarding_step) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'https://a.ch', 'A', 8),
  ('b2222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'https://b.ch', 'B', 8);

do $$
declare n int; ok boolean; qid uuid; wk date := date_trunc('week', now() at time zone 'Europe/Zurich')::date;
begin
  -- 1. Offres
  select ai_questions into n from public.plans where code = 'grow';
  if n <> 10 then raise exception 'ECHEC 1 : Grow devrait avoir 10 questions (%)', n; end if;

  -- 2. Quota : 10 questions pour Grow, la 11e est refusée
  for i in 1..10 loop
    insert into public.ai_questions (workspace_id, site_id, question) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'Question numéro ' || i);
  end loop;
  ok := false;
  begin
    insert into public.ai_questions (workspace_id, site_id, question) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'Question en trop');
  exception when sqlstate 'Q0001' then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : la 11e question est acceptée'; end if;

  -- 3. Site d'un autre espace : refusé
  ok := false;
  begin
    insert into public.ai_questions (workspace_id, site_id, question) values ('11111111-0000-0000-0000-000000000001', 'b2222222-0000-0000-0000-000000000002', 'Question pirate');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 3 : question acceptée sur le site d''un autre espace'; end if;

  -- 4. Liste des sites à interroger : A (questions) oui, B (aucune question) non ; après un passage terminé, plus A
  select count(*) into n from public.ai_visibility_due() d where d.site_id = 'a1111111-0000-0000-0000-000000000001';
  if n <> 1 then raise exception 'ECHEC 4 : le site A devrait être à interroger'; end if;
  select count(*) into n from public.ai_visibility_due() d where d.site_id = 'b2222222-0000-0000-0000-000000000002';
  if n <> 0 then raise exception 'ECHEC 4 : le site B n''a pas de question'; end if;
  insert into public.ai_runs (workspace_id, site_id, week, status, finished_at) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', wk, 'done', now());
  select count(*) into n from public.ai_visibility_due();
  if n <> 0 then raise exception 'ECHEC 4 : site encore à interroger après le passage de la semaine'; end if;

  -- 5. Semaine qui ne commence pas un lundi : refusée
  ok := false;
  select id into qid from public.ai_questions limit 1;
  begin
    insert into public.ai_checks (workspace_id, site_id, question_id, engine, week) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', qid, 'chatgpt', wk + 1);
  exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : semaine hors lundi acceptée'; end if;
  insert into public.ai_checks (workspace_id, site_id, question_id, engine, week, cited, position) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', qid, 'chatgpt', wk, true, 2);

  -- 6. Le membre lit ses questions et réponses, sans pouvoir écrire
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  select count(*) into n from public.ai_checks;
  if n <> 1 then raise exception 'ECHEC 6 : le membre ne lit pas ses réponses (%)', n; end if;
  select count(*) into n from public.ai_questions;
  if n <> 10 then raise exception 'ECHEC 6 : le membre ne lit pas ses questions (%)', n; end if;
  ok := false;
  begin insert into public.ai_questions (workspace_id, site_id, question) values ('11111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'Question du navigateur'); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre écrit une question directement'; end if;
  ok := false;
  begin update public.ai_checks set cited = false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre modifie une réponse'; end if;
  ok := false;
  begin perform * from public.ai_visibility_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : un membre appelle ai_visibility_due'; end if;

  -- 7. Un autre espace ne voit rien
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  select count(*) into n from public.ai_checks;
  if n <> 0 then raise exception 'ECHEC 7 : un autre espace voit les réponses'; end if;
  select count(*) into n from public.ai_questions;
  if n <> 0 then raise exception 'ECHEC 7 : un autre espace voit les questions'; end if;

  -- 8. Sans compte : rien
  reset role; set local role anon;
  ok := false;
  begin perform id from public.ai_checks; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 8 : lisible sans compte'; end if;
  reset role;
  raise notice 'visibilite_ia_test : 8 contrôles réussis';
end $$;
rollback;
