-- Offre Agence : offre en base, nombre de sites limité par l'offre, rapports lisibles par les membres
-- seulement, aucune écriture côté navigateur, liste des rapports à envoyer.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'ga@test.ch'), ('bbbbbbbb-0000-0000-0000-0000000000d2', 'gb@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-0000000000d1', 'GA'), ('22222222-0000-0000-0000-0000000000d2', 'GB');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'owner'),
  ('22222222-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'owner');
insert into public.subscriptions (workspace_id, plan_code, status) values
  ('11111111-0000-0000-0000-0000000000d1', 'grow', 'active'), ('22222222-0000-0000-0000-0000000000d2', 'agence', 'active');

do $$
declare n int; ok boolean; t text;
begin
  -- 1. L'offre Agence
  select sites * 1000 + rank_keywords into n from public.plans where code = 'agence';
  if n <> 25100 then raise exception 'ECHEC 1 : offre agence %', n; end if;

  -- 2. Grow : 1 site ; Agence : 25
  insert into public.sites (id, workspace_id, url, name, onboarding_step) values ('a1111111-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'https://ga.ch', 'GA', 8);
  ok := false;
  begin insert into public.sites (workspace_id, url, name) values ('11111111-0000-0000-0000-0000000000d1', 'https://ga2.ch', 'GA2');
  exception when sqlstate 'Q0001' then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : 2e site accepté en Grow'; end if;
  insert into public.sites (workspace_id, url, name, onboarding_step)
    select '22222222-0000-0000-0000-0000000000d2', 'https://client' || i || '.ch', 'C' || i, 8 from generate_series(1, 25) i;
  ok := false;
  begin insert into public.sites (workspace_id, url, name) values ('22222222-0000-0000-0000-0000000000d2', 'https://client26.ch', 'C26');
  exception when sqlstate 'Q0001' then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : 26e site accepté en Agence'; end if;

  -- 3. Rapport : jeton long et unique, 3 adresses au plus, couleur et logo contrôlés
  insert into public.site_reports (site_id, workspace_id, shared, monthly, client_emails)
    select id, workspace_id, true, true, '{client@c1.ch}' from public.sites where url = 'https://client1.ch';
  select token into t from public.site_reports r join public.sites s on s.id = r.site_id where s.url = 'https://client1.ch';
  if t !~ '^[0-9a-f]{64}$' then raise exception 'ECHEC 3 : jeton %', t; end if;
  ok := false;
  begin update public.site_reports set client_emails = '{a@x.ch,b@x.ch,c@x.ch,d@x.ch}' where token = t; exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 3 : 4 adresses acceptées'; end if;
  ok := false;
  begin insert into public.workspace_branding (workspace_id, logo_url) values ('22222222-0000-0000-0000-0000000000d2', 'http://pas-sur.ch/logo.png'); exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 3 : logo en http accepté'; end if;
  insert into public.workspace_branding (workspace_id, agency_name, accent) values ('22222222-0000-0000-0000-0000000000d2', 'Agence GB', '#0f766e');

  -- 4. À envoyer : une fois par mois
  select count(*) into n from public.reports_due() d where d.workspace_id = '22222222-0000-0000-0000-0000000000d2';
  if n <> 1 then raise exception 'ECHEC 4 : % rapports à envoyer', n; end if;
  update public.site_reports set last_sent_month = date_trunc('month', now() at time zone 'Europe/Zurich')::date where token = t;
  select count(*) into n from public.reports_due() d where d.workspace_id = '22222222-0000-0000-0000-0000000000d2';
  if n <> 0 then raise exception 'ECHEC 4 : rapport renvoyé le même mois'; end if;

  -- 5. Le membre lit sa marque et ses rapports, n'écrit pas, n'appelle pas reports_due
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000d2', true);
  select count(*) into n from public.site_reports;
  if n <> 1 then raise exception 'ECHEC 5 : le membre voit % rapports', n; end if;
  select count(*) into n from public.workspace_branding;
  if n <> 1 then raise exception 'ECHEC 5 : le membre ne voit pas sa marque'; end if;
  ok := false;
  begin update public.site_reports set shared = false; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : un membre modifie le rapport'; end if;
  ok := false;
  begin perform * from public.reports_due(); exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 5 : un membre lit les rapports de tous'; end if;

  -- 6. Un autre espace ne voit ni la marque ni le jeton
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000d1', true);
  select count(*) into n from public.site_reports;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit le jeton'; end if;
  select count(*) into n from public.workspace_branding;
  if n <> 0 then raise exception 'ECHEC 6 : un autre espace voit la marque'; end if;

  reset role;
  raise notice 'agence_test : 6 contrôles réussis';
end $$;
rollback;
