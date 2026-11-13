-- Publicités : les annonces d'un article sont lisibles par les membres de l'espace seulement, et
-- personne ne peut les écrire depuis le navigateur.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-0000000000d1', 'a@pub.ch'), ('bbbbbbbb-0000-0000-0000-0000000000d2', 'b@pub.ch');
insert into public.workspaces (id, name) values ('11111111-0000-0000-0000-0000000000d1', 'A'), ('22222222-0000-0000-0000-0000000000d2', 'B');
insert into public.memberships (workspace_id, user_id, role) values
  ('11111111-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'owner'),
  ('22222222-0000-0000-0000-0000000000d2', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'owner');
insert into public.sites (id, workspace_id, url, name) values
  ('a1111111-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'https://a-pub.ch', 'A'),
  ('b2222222-0000-0000-0000-0000000000d2', '22222222-0000-0000-0000-0000000000d2', 'https://b-pub.ch', 'B');
insert into public.articles (id, workspace_id, site_id, title, slug, body_md, language) values
  ('c3333333-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'a1111111-0000-0000-0000-0000000000d1', 'Un article', 'un-article', 'Texte', 'fr');
insert into public.ad_drafts (article_id, workspace_id, site_id, google, meta, landing_url)
  values ('c3333333-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'a1111111-0000-0000-0000-0000000000d1', '{"headlines":[]}', '{"headline":"x"}', 'https://a-pub.ch/un-article/');

do $$
declare n int; ok boolean;
begin
  -- 1. Site d'un autre espace : refusé
  begin
    insert into public.ad_drafts (article_id, workspace_id, site_id, google, meta, landing_url)
      values ('c3333333-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'b2222222-0000-0000-0000-0000000000d2', '{}', '{}', 'https://b-pub.ch/x/');
    raise exception 'ECHEC 1 : annonces acceptées pour le site d''un autre espace';
  exception when insufficient_privilege or unique_violation then null; end;
  -- 2. Adresse de destination en https seulement
  ok := false;
  begin update public.ad_drafts set landing_url = 'javascript:alert(1)'; exception when check_violation then ok := true; end;
  if not ok then raise exception 'ECHEC 2 : adresse de destination non vérifiée'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000d1', true);
  select count(*) into n from public.ad_drafts;
  if n <> 1 then raise exception 'ECHEC 3 : le membre ne lit pas ses annonces (%)', n; end if;
  ok := false;
  begin update public.ad_drafts set status = 'approved'; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : un membre peut écrire les annonces'; end if;
  ok := false;
  begin delete from public.ad_drafts; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 4 : un membre peut supprimer les annonces'; end if;

  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-0000000000d2', true);
  select count(*) into n from public.ad_drafts;
  if n <> 0 then raise exception 'ECHEC 5 : un autre espace voit les annonces'; end if;
  reset role; set local role anon;
  ok := false;
  begin perform article_id from public.ad_drafts; exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'ECHEC 6 : lisible sans compte'; end if;
  reset role;
  raise notice 'publicites_test : 6 contrôles réussis';
end $$;
rollback;
