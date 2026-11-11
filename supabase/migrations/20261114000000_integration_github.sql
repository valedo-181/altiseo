-- Site statique sur GitHub : Altiseo écrit chaque article en JSON dans le dépôt du site
-- (ex. domevia.ch sur Vercel). Le jeton d'accès est gardé chiffré dans credentials_enc, comme
-- le mot de passe d'application WordPress ; config = { endpoint, repo, branch, dir }.
alter table public.integrations drop constraint if exists integrations_kind_check;
alter table public.integrations add constraint integrations_kind_check
  check (kind in ('wordpress', 'webflow', 'shopify', 'framer', 'wix', 'ghost', 'webhook', 'github'));
