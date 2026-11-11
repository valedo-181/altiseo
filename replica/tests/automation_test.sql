-- Publication automatique : automation_due() ne rend que les sujets à écrire, et seul le serveur peut l'appeler.
\set ON_ERROR_STOP on
begin;
insert into public.workspaces (id, name) values
  ('11111111-0000-0000-0000-0000000000a1', 'Actif'), ('11111111-0000-0000-0000-0000000000a2', 'Essai fini'),
  ('11111111-0000-0000-0000-0000000000a3', 'Suspendu'), ('11111111-0000-0000-0000-0000000000a4', 'Onboarding');
update public.workspaces set suspended_at = now() where id = '11111111-0000-0000-0000-0000000000a3';
insert into public.subscriptions (workspace_id, plan_code, status, trial_ends_at) values
  ('11111111-0000-0000-0000-0000000000a1', 'grow', 'trialing', now() + interval '2 days'),
  ('11111111-0000-0000-0000-0000000000a2', 'grow', 'trialing', now() - interval '1 day'),
  ('11111111-0000-0000-0000-0000000000a3', 'grow', 'active', null),
  ('11111111-0000-0000-0000-0000000000a4', 'grow', 'active', null);
insert into public.sites (id, workspace_id, url, name, onboarding_step) values
  ('22222222-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-0000000000a1', 'https://a1.ch', 'A1', 8),
  ('22222222-0000-0000-0000-0000000000a2', '11111111-0000-0000-0000-0000000000a2', 'https://a2.ch', 'A2', 8),
  ('22222222-0000-0000-0000-0000000000a3', '11111111-0000-0000-0000-0000000000a3', 'https://a3.ch', 'A3', 8),
  ('22222222-0000-0000-0000-0000000000a4', '11111111-0000-0000-0000-0000000000a4', 'https://a4.ch', 'A4', 3);
insert into public.calendar_items (id, workspace_id, site_id, scheduled_for, title, status) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1', current_date, 'Sujet du jour', 'approved'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1', current_date - 1, 'Pas approuvé', 'proposed'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1', current_date - 5, 'Trop vieux', 'approved'),
  ('33333333-0000-0000-0000-000000000004', '11111111-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1', current_date + 5, 'Plus tard', 'approved'),
  ('33333333-0000-0000-0000-000000000005', '11111111-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-0000000000a1', current_date - 2, 'En cours depuis peu', 'generating'),
  ('33333333-0000-0000-0000-000000000006', '11111111-0000-0000-0000-0000000000a2', '22222222-0000-0000-0000-0000000000a2', current_date, 'Essai fini', 'approved'),
  ('33333333-0000-0000-0000-000000000007', '11111111-0000-0000-0000-0000000000a3', '22222222-0000-0000-0000-0000000000a3', current_date, 'Suspendu', 'approved'),
  ('33333333-0000-0000-0000-000000000008', '11111111-0000-0000-0000-0000000000a4', '22222222-0000-0000-0000-0000000000a4', current_date, 'Onboarding', 'approved');

do $$
declare ids text; n int; ok boolean;
begin
  select string_agg(right(item_id::text, 1), ',' order by item_id), max(articles_left) into ids, n from public.automation_due();
  if ids is distinct from '1' then raise exception 'ECHEC 1 : sujets rendus = % (attendu : 1)', ids; end if;
  if n <> 30 then raise exception 'ECHEC 2 : quota restant = % (attendu : 30)', n; end if;

  -- 3. Un sujet resté « en rédaction » plus de 30 minutes (panne) est repris
  alter table public.calendar_items disable trigger user;
  update public.calendar_items set updated_at = now() - interval '45 minutes' where id = '33333333-0000-0000-0000-000000000005';
  alter table public.calendar_items enable trigger user;
  select count(*) into n from public.automation_due();
  if n <> 2 then raise exception 'ECHEC 3 : sujet bloqué non repris (%)', n; end if;

  -- 4. Réservé au serveur
  set local role authenticated;
  ok := false;
  begin perform * from public.automation_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : appelable par un compte client'; end if;
  reset role; set local role anon;
  ok := false;
  begin perform * from public.automation_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : appelable sans compte'; end if;
  reset role; set local role service_role;
  perform * from public.automation_due();
  reset role;
  raise notice 'automation_test : 4 contrôles réussis';
end $$;
rollback;
