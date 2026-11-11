-- Suivi des mots-clés : le jeton Google n'est lisible par personne côté navigateur, et les membres
-- d'un espace ne voient ni n'écrivent la connexion d'un autre.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.ch'), ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-000000000001', 'A'), ('22222222-0000-0000-0000-000000000002', 'B');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
  ('22222222-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'owner');
insert into public.sites (id, workspace_id, url, name) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'https://a.ch', 'A'),
  ('b2222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'https://b.ch', 'B');
insert into public.search_connections (site_id, workspace_id, property, credentials_enc, report)
  values ('a1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'sc-domain:a.ch', '\x01', '{"queries":[]}');

do $$
declare n int; ok boolean;
begin
  -- 1. Site d'un autre espace : refusé par le déclencheur
  begin
    insert into public.search_connections (site_id, workspace_id, property) values ('b2222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'sc-domain:b.ch');
    raise exception 'ECHEC 1 : connexion acceptée pour le site d''un autre espace';
  exception when insufficient_privilege then null; end;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  -- 2. Le membre lit sa connexion et son rapport
  select count(*) into n from public.search_connections where report is not null;
  if n <> 1 then raise exception 'ECHEC 2 : le membre ne lit pas sa connexion (%)', n; end if;
  -- 3. Le jeton chiffré n'est pas lisible
  ok := false;
  begin perform credentials_enc from public.search_connections; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 3 : le jeton est lisible par un membre'; end if;
  -- 4. Aucune écriture pour un membre
  ok := false;
  begin update public.search_connections set property = 'sc-domain:pirate.ch'; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : un membre peut modifier la connexion'; end if;
  ok := false;
  begin delete from public.search_connections; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : un membre peut supprimer la connexion'; end if;

  -- 5. Un autre espace ne voit rien
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', true);
  select count(*) into n from public.search_connections;
  if n <> 0 then raise exception 'ECHEC 5 : un autre espace voit la connexion'; end if;

  -- 6. Sans compte : rien
  reset role; set local role anon;
  ok := false;
  begin perform site_id from public.search_connections; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : lisible sans compte'; end if;
  reset role;
  raise notice 'search_test : 6 contrôles réussis';
end $$;
rollback;
