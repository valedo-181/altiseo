-- Image d'illustration des articles (créée par IA, photo réaliste) et image mise en avant dans WordPress.
alter table public.articles
  add column image_url text,                                   -- adresse publique dans le stockage ; null = pas d'image
  add column image_alt text not null default '' check (length(image_alt) <= 200),
  add column image_prompt text check (image_prompt is null or length(image_prompt) <= 1000),
  add column image_demo boolean not null default false,        -- image d'exemple (sans clé Higgsfield)
  add column image_generations smallint not null default 0 check (image_generations between 0 and 50);

-- Image déjà envoyée au CMS : on ne la renvoie que si elle a changé.
alter table public.publications
  add column remote_media_id text,
  add column remote_media_src text;

-- Stockage public (les images sont faites pour être publiées) ; seul le serveur (service_role) y écrit.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('article-images', 'article-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
      on conflict (id) do nothing;
  end if;
end $$;
