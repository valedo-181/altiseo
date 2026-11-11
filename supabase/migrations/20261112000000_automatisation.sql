-- Publication automatique : la liste des sujets que la tâche quotidienne peut écrire.
-- Réservée au serveur (service_role) : elle traverse tous les espaces.
-- Sont retenus : les sujets approuvés (ou restés « en rédaction » plus de 30 minutes après une panne),
-- prévus entre avant-hier et demain (le jour exact se juge dans le fuseau du site, côté serveur),
-- d'un site configuré, d'un espace non suspendu, avec un abonnement actif ou un essai en cours.

create or replace function public.automation_due()
returns table (workspace_id uuid, site_id uuid, item_id uuid, scheduled_for date, publish_time text, timezone text, articles_left int)
language sql stable security definer set search_path = public as $$
  select c.workspace_id, c.site_id, c.id, c.scheduled_for, to_char(s.publish_time, 'HH24:MI'), s.timezone,
         coalesce(public._articles_left(c.workspace_id), 0)
    from public.calendar_items c
    join public.sites s on s.id = c.site_id
    join public.workspaces w on w.id = c.workspace_id
    join public.subscriptions sub on sub.workspace_id = c.workspace_id
   where (c.status = 'approved' or (c.status = 'generating' and c.updated_at < now() - interval '30 minutes'))
     and c.scheduled_for between current_date - 2 and current_date + 1
     and s.onboarding_step >= 8
     and w.suspended_at is null
     and (sub.status = 'active' or (sub.status = 'trialing' and (sub.trial_ends_at is null or sub.trial_ends_at > now())))
     and not exists (select 1 from public.articles a where a.calendar_item_id = c.id)
   order by c.scheduled_for, c.created_at;
$$;
revoke execute on function public.automation_due() from public, anon, authenticated;
grant execute on function public.automation_due() to service_role;
