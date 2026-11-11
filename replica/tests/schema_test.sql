-- Tests du schéma supabase/migrations (Postgres local qui imite Supabase).
-- Chaque vérification lève une exception si elle échoue.
\set ON_ERROR_STOP on

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),   -- Alice
  ('00000000-0000-0000-0000-00000000000b');   -- Bruno

set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.ensure_workspace('Atelier Alice') as wa \gset
insert into public.sites (workspace_id, url) values (:'wa', 'https://alice.example') returning id as sa \gset
insert into public.calendar_items (workspace_id, site_id, scheduled_for, title)
  values (:'wa', :'sa', '2026-12-01', 'Premier sujet');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select public.ensure_workspace('Boutique Bruno') as wb \gset
insert into public.sites (workspace_id, url) values (:'wb', 'https://bruno.example') returning id as sb \gset

select set_config('t.wa', :'wa', false), set_config('t.sa', :'sa', false),
       set_config('t.wb', :'wb', false), set_config('t.sb', :'sb', false);

-- 1. Bruno ne voit rien de l'espace d'Alice
do $$ begin
  if (select count(*) from public.sites) <> 1 then raise exception 'ÉCHEC 1 : Bruno voit le site d''Alice'; end if;
  if (select count(*) from public.calendar_items) <> 0 then raise exception 'ÉCHEC 1 : Bruno voit le calendrier d''Alice'; end if;
  if (select count(*) from public.workspaces) <> 1 then raise exception 'ÉCHEC 1 : Bruno voit l''espace d''Alice'; end if;
end $$;

-- 2. Bruno ne peut pas créer un site dans l'espace d'Alice
do $$ declare w uuid := current_setting('t.wa')::uuid; begin
  begin
    insert into public.sites (workspace_id, url) values (w, 'https://intrus.example');
    raise exception 'ÉCHEC 2 : site créé dans l''espace d''Alice';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 3. Bruno ne peut pas rattacher, dans son espace, un concurrent au site d'Alice
do $$ declare w uuid := current_setting('t.wb')::uuid; s uuid := current_setting('t.sa')::uuid; begin
  begin
    insert into public.competitors (workspace_id, site_id, url) values (w, s, 'https://c.example');
    raise exception 'ÉCHEC 3 : concurrent rattaché au site d''un autre espace';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 4. Identifiants CMS : jamais lisibles depuis le navigateur
reset role;
insert into public.integrations (workspace_id, site_id, kind, credentials_enc, status)
  values (:'wb', :'sb', 'wordpress', '\x00ff'::bytea, 'ok');
set role authenticated;
do $$ begin
  if (select count(*) from public.integrations_public) <> 1 then raise exception 'ÉCHEC 4 : la vue ne montre pas l''intégration'; end if;
  begin
    perform credentials_enc from public.integrations;
    raise exception 'ÉCHEC 4 : credentials_enc lisible';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 5. Un seul sujet par jour et par site
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ declare w uuid := current_setting('t.wa')::uuid; s uuid := current_setting('t.sa')::uuid; begin
  begin
    insert into public.calendar_items (workspace_id, site_id, scheduled_for, title) values (w, s, '2026-12-01', 'Doublon');
    raise exception 'ÉCHEC 5 : deux sujets le même jour';
  exception when unique_violation then null;
  end;
end $$;

-- 6. Un membre ne crée pas d'article lui-même et n'écrit pas son abonnement
do $$ declare w uuid := current_setting('t.wa')::uuid; s uuid := current_setting('t.sa')::uuid; begin
  begin
    insert into public.articles (workspace_id, site_id, title, slug, language) values (w, s, 'x', 'x', 'fr');
    raise exception 'ÉCHEC 6 : article créé depuis le navigateur';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (workspace_id, plan_code, status) values (w, 'scale', 'active');
    raise exception 'ÉCHEC 6 : abonnement écrit depuis le navigateur';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 7. Quota : 30 articles sur Grow, le 31e est refusé ; sans abonnement, aucun
reset role;
update public.subscriptions set status = 'canceled' where workspace_id = :'wa';
do $$ declare w uuid := current_setting('t.wa')::uuid; s uuid := current_setting('t.sa')::uuid; begin
  begin
    insert into public.articles (workspace_id, site_id, title, slug, language, counted_in_period)
      values (w, s, 'x', 'sans-abo', 'fr', current_date);
    raise exception 'ÉCHEC 7 : article sans abonnement';
  exception when sqlstate 'Q0002' then null;
  end;
end $$;
update public.subscriptions set status = 'trialing' where workspace_id = :'wa';
insert into public.articles (workspace_id, site_id, title, slug, language, counted_in_period)
  select :'wa', :'sa', 'Article ' || g, 'article-' || g, 'fr', current_date from generate_series(1, 30) g;
do $$ declare w uuid := current_setting('t.wa')::uuid; s uuid := current_setting('t.sa')::uuid; begin
  if public._articles_left(w) <> 0 then raise exception 'ÉCHEC 7 : reste %', public._articles_left(w); end if;
  begin
    insert into public.articles (workspace_id, site_id, title, slug, language, counted_in_period)
      values (w, s, 'Trop', 'article-31', 'fr', current_date);
    raise exception 'ÉCHEC 7 : quota dépassé';
  exception when sqlstate 'Q0001' then null;
  end;
end $$;

-- 8. Alice voit ses 30 articles, Bruno aucun
set role authenticated;
do $$ begin
  if (select count(*) from public.articles) <> 30 then raise exception 'ÉCHEC 8 : Alice voit % articles', (select count(*) from public.articles); end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from public.articles) <> 0 then raise exception 'ÉCHEC 8 : Bruno voit les articles d''Alice'; end if;
end $$;

reset role;

-- 9. Premier accès : ensure_workspace crée un seul espace avec un essai, même appelée deux fois
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.ensure_workspace('Chloé') as wc1 \gset
select public.ensure_workspace('Chloé') as wc2 \gset
do $$ begin
  if (select count(*) from public.memberships) <> 1 then raise exception 'ÉCHEC 9 : % espaces', (select count(*) from public.memberships); end if;
  if (select status from public.subscriptions) <> 'trialing' then raise exception 'ÉCHEC 9 : pas d''essai'; end if;
  if public.articles_left((select workspace_id from public.memberships)) <> 30 then raise exception 'ÉCHEC 9 : quota de départ'; end if;
end $$;
select (:'wc1' = :'wc2') as same_ws \gset
\if :same_ws
\else
  do $$ begin raise exception 'ÉCHEC 9 : deux espaces différents'; end $$;
\endif
reset role;
set role anon;
do $$ begin
  begin
    perform public.ensure_workspace('x');
    raise exception 'ÉCHEC 9 : anon peut appeler ensure_workspace';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 10. Un compte ne lit pas le quota d'un autre espace
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if public.articles_left(current_setting('t.wa')::uuid) is not null then raise exception 'ÉCHEC 10 : Bruno lit le quota d''Alice'; end if;
  if public.articles_left(current_setting('t.wb')::uuid) is null then raise exception 'ÉCHEC 10 : Bruno ne lit pas son propre espace'; end if;
end $$;
reset role;
select 'schema_test : 10 vérifications OK' as resultat;

-- Intégration « site statique (GitHub) » (20261114000000) : le type est accepté, un type inconnu refusé.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'integrations_kind_check'
                 and pg_get_constraintdef(oid) like '%github%') then
    raise exception 'integrations_kind_check doit accepter github';
  end if;
  if exists (select 1 from pg_constraint where conname = 'integrations_kind_check'
             and pg_get_constraintdef(oid) like '%gitlab%') then
    raise exception 'type inattendu';
  end if;
end $$;
