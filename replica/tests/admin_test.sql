-- Console super admin : accès réservé (liste + double authentification), suspension, journal.
-- S'exécute après schema_test.sql (réutilise Alice, Bruno et leurs espaces).
\set ON_ERROR_STOP on
reset role;
select id as wa from public.workspaces where name = 'Atelier Alice' \gset
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000ad');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
select set_config('t.wa', :'wa', false);

set role authenticated;

-- 1. Un client ordinaire ne lit rien, même en aal2
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ begin
  begin perform * from public.admin_workspaces(); raise exception 'ÉCHEC A1'; exception when insufficient_privilege then null; end;
  begin perform public.admin_suspend(current_setting('t.wa')::uuid, 'x'); raise exception 'ÉCHEC A1 bis'; exception when insufficient_privilege then null; end;
end $$;

-- 2. L'admin sans double authentification (aal1) est refusé
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
do $$ begin
  if (public.platform_admin_status() ->> 'listed')::boolean is not true then raise exception 'ÉCHEC A2 : pas listé'; end if;
  begin perform * from public.admin_workspaces(); raise exception 'ÉCHEC A2'; exception when insufficient_privilege then null; end;
end $$;

-- 3. En aal2 : voit tous les espaces, prolonge l'essai, change d'offre, suspend ; tout est journalisé
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
do $$ declare w uuid := current_setting('t.wa')::uuid; n int; begin
  select count(*) into n from public.admin_workspaces();
  if n < 3 then raise exception 'ÉCHEC A3 : % espaces', n; end if;
  if (select articles_period from public.admin_workspaces() where id = w) <> 30 then raise exception 'ÉCHEC A3 : articles de la période'; end if;
  perform public.admin_extend_trial(w, 7);
  perform public.admin_set_plan(w, 'scale');
  begin perform public.admin_suspend(w, '  '); raise exception 'ÉCHEC A3 : suspension sans raison'; exception when sqlstate '22023' then null; end;
  perform public.admin_suspend(w, 'Impayé');
  if (select count(*) from public.admin_journal(w)) <> 3 then raise exception 'ÉCHEC A3 : journal'; end if;
end $$;

-- 4. Alice, suspendue, ne voit plus ses données mais sait pourquoi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
do $$ begin
  if (select count(*) from public.sites) <> 0 then raise exception 'ÉCHEC A4 : données visibles'; end if;
  if (select reason from public.my_suspension()) <> 'Impayé' then raise exception 'ÉCHEC A4 : raison'; end if;
end $$;

-- 5. Réactivation : l'accès revient
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
select public.admin_unsuspend(:'wa');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if (select count(*) from public.sites) <> 1 then raise exception 'ÉCHEC A5'; end if;
end $$;

-- 6. Les tables de la console sont illisibles directement, même pour l'admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$ begin
  if (select count(*) from public.platform_audit) <> 0 or (select count(*) from public.platform_admins) <> 0 then raise exception 'ÉCHEC A6'; end if;
end $$;

reset role;
select 'admin_test : 6 vérifications OK' as resultat;
