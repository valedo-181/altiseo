-- Console super admin, suite : création et suppression d'un client, fiche, note, administrateurs.
-- S'exécute après admin_test.sql (réutilise l'administrateur …ad et les espaces existants).
\set ON_ERROR_STOP on
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'Nouveau@Client.ch'), ('00000000-0000-0000-0000-0000000000c2', 'collegue@altiseo.ch');
update auth.users set email = 'admin@altiseo.ch' where id = '00000000-0000-0000-0000-0000000000ad';
set role authenticated;

-- 1. Un client ordinaire, même en aal2, ne peut rien faire
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ begin
  begin perform public.admin_create_workspace('nouveau@client.ch', 'X', 'grow', 7); raise exception 'ÉCHEC P1'; exception when insufficient_privilege then null; end;
  begin perform public.admin_add_admin('nouveau@client.ch'); raise exception 'ÉCHEC P1 : il se nomme administrateur'; exception when insufficient_privilege then null; end;
  begin perform * from public.admin_list_admins(); raise exception 'ÉCHEC P1 bis'; exception when insufficient_privilege then null; end;
end $$;

-- 2. L'administrateur sans double authentification est refusé
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
do $$ begin
  begin perform public.admin_create_workspace('nouveau@client.ch', 'X', 'grow', 7); raise exception 'ÉCHEC P2'; exception when insufficient_privilege then null; end;
end $$;

-- 3. En aal2 : création (adresse sans tenir compte des majuscules), refus des doublons et des mauvaises valeurs
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ declare w uuid; d jsonb; begin
  begin perform public.admin_create_workspace('inconnu@nulle-part.ch', 'X', 'grow', 7); raise exception 'ÉCHEC P3 : compte inconnu'; exception when sqlstate 'P0002' then null; end;
  begin perform public.admin_create_workspace('nouveau@client.ch', '  ', 'grow', 7); raise exception 'ÉCHEC P3 : nom vide'; exception when sqlstate '22023' then null; end;
  begin perform public.admin_create_workspace('nouveau@client.ch', 'X', 'platine', 7); raise exception 'ÉCHEC P3 : offre inconnue'; exception when sqlstate '22023' then null; end;
  begin perform public.admin_create_workspace('nouveau@client.ch', 'X', 'grow', 400); raise exception 'ÉCHEC P3 : essai trop long'; exception when sqlstate '22023' then null; end;
  w := public.admin_create_workspace('nouveau@client.ch', 'Menuiserie Test', 'scale', 14);
  perform set_config('t.new', w::text, false);
  if (select plan_code || ':' || sub_status from public.admin_workspaces() where id = w) <> 'scale:trialing' then raise exception 'ÉCHEC P3 : offre ou essai'; end if;
  begin perform public.admin_create_workspace('nouveau@client.ch', 'Deux', 'grow', 7); raise exception 'ÉCHEC P3 : deuxième espace'; exception when unique_violation then null; end;

  -- 4. Fiche et note interne
  perform public.admin_set_note(w, '  Rappeler en janvier  ');
  d := public.admin_workspace_detail(w);
  if d ->> 'note' <> 'Rappeler en janvier' or d -> 'members' -> 0 ->> 'role' <> 'owner' or jsonb_array_length(d -> 'sites') <> 0 then raise exception 'ÉCHEC P4 : %', d; end if;
  perform public.admin_set_note(w, '');
  if public.admin_workspace_detail(w) ->> 'note' is not null then raise exception 'ÉCHEC P4 : note non effacée'; end if;
  if exists (select 1 from public.admin_journal(w) where data::text like '%Rappeler%') then raise exception 'ÉCHEC P4 : le texte de la note est dans le journal'; end if;
end $$;

-- 5. Le client créé voit son espace, pas la note
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
do $$ declare n int; ok boolean := false; begin
  select count(*) into n from public.workspaces where id = current_setting('t.new')::uuid;
  if n <> 1 then raise exception 'ÉCHEC P5 : le client ne voit pas son espace'; end if;
  select count(*) into n from public.platform_notes;
  if n <> 0 then raise exception 'ÉCHEC P5 : le client lit les notes internes'; end if;
end $$;

-- 6. Administrateurs : ajout, liste, pas de retrait de soi-même
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ declare n int; begin
  begin perform public.admin_add_admin('personne@nulle-part.ch'); raise exception 'ÉCHEC P6 : compte inconnu'; exception when sqlstate 'P0002' then null; end;
  perform public.admin_add_admin('Collegue@Altiseo.ch');
  begin perform public.admin_add_admin('collegue@altiseo.ch'); raise exception 'ÉCHEC P6 : doublon'; exception when unique_violation then null; end;
  select count(*) into n from public.admin_list_admins();
  if n <> 2 then raise exception 'ÉCHEC P6 : % administrateurs', n; end if;
  if (select added_by_email from public.admin_list_admins() where email = 'collegue@altiseo.ch') <> 'admin@altiseo.ch' then raise exception 'ÉCHEC P6 : qui a ajouté'; end if;
  begin perform public.admin_remove_admin('00000000-0000-0000-0000-0000000000ad'); raise exception 'ÉCHEC P6 : retrait de soi-même'; exception when sqlstate '22023' then null; end;
end $$;

-- 7. Le nouvel administrateur n'a aucun droit sans sa propre double authentification, puis peut agir
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
do $$ begin
  begin perform * from public.admin_workspaces(); raise exception 'ÉCHEC P7'; exception when insufficient_privilege then null; end;
end $$;

-- 8. Suppression : nom à retaper, espace d'un administrateur protégé, comptes sans espace renvoyés
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ declare w uuid := current_setting('t.new')::uuid; orphans uuid[]; mine uuid; begin
  begin perform public.admin_delete_workspace(w, 'menuiserie test'); raise exception 'ÉCHEC P8 : nom approximatif accepté'; exception when sqlstate '22023' then null; end;
  perform public.admin_remove_admin('00000000-0000-0000-0000-0000000000c2');
  mine := public.admin_create_workspace('collegue@altiseo.ch', 'Espace du collègue', 'grow', 7);
  perform public.admin_add_admin('collegue@altiseo.ch');
  begin perform public.admin_delete_workspace(mine, 'Espace du collègue'); raise exception 'ÉCHEC P8 : espace d''un administrateur supprimé'; exception when insufficient_privilege then null; end;
  orphans := public.admin_delete_workspace(w, 'Menuiserie Test');
  if orphans <> array['00000000-0000-0000-0000-0000000000c1'::uuid] then raise exception 'ÉCHEC P8 : comptes sans espace = %', orphans; end if;
  if exists (select 1 from public.admin_workspaces() where id = w) then raise exception 'ÉCHEC P8 : espace toujours là'; end if;
  if not exists (select 1 from public.admin_journal() where action = 'delete_workspace' and data ->> 'name' = 'Menuiserie Test') then raise exception 'ÉCHEC P8 : suppression absente du journal'; end if;
end $$;

reset role;
select 'admin_plus_test : 8 vérifications OK' as resultat;
