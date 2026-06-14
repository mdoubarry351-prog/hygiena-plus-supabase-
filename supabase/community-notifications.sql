-- =====================================================
-- Hygiena+ — Notifications communautaires (triggers)
-- À exécuter dans Supabase → SQL Editor. Idempotent (ré-exécutable).
--
-- Crée automatiquement une notification quand :
--   • quelqu'un commente votre publication,
--   • quelqu'un répond à votre commentaire,
--   • un médecin vérifié répond à votre publication / commentaire (message dédié),
--   • votre publication reçoit une réaction (like).
--
-- Sécurité : fonctions SECURITY DEFINER → les notifications sont créées côté
-- serveur (jamais d'insertion client dans les notifications d'autrui).
-- Anonymat : les messages ne révèlent JAMAIS l'identité de l'auteur de l'action.
-- Le destinataire est toujours l'auteur du contenu concerné.
--
-- L'app (écran Notifications) sait déjà afficher les types `community_comment`
-- et `community_like` et ouvrir la publication via data = {kind:"post", postId}.
-- =====================================================

-- Helper : l'utilisateur est-il un médecin validé ?
create or replace function public.is_validated_doctor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.doctors d
    where d.user_id = p_user and d.is_validated = true
  );
$$;

-- ---------------- Commentaires & réponses ----------------
create or replace function public.notify_on_community_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner   uuid;
  v_parent_owner uuid;
  v_is_doctor    boolean;
begin
  select user_id into v_post_owner from public.community_posts where id = NEW.post_id;
  v_is_doctor := public.is_validated_doctor(NEW.user_id);

  -- Réponse à un commentaire → notifier l'auteur du commentaire parent.
  if NEW.parent_comment_id is not null then
    select user_id into v_parent_owner from public.community_comments where id = NEW.parent_comment_id;
    if v_parent_owner is not null and v_parent_owner <> NEW.user_id then
      insert into public.notifications (user_id, title, message, type, data)
      values (
        v_parent_owner,
        'Nouvelle réponse',
        case when v_is_doctor
          then 'Un médecin vérifié a répondu à votre commentaire.'
          else 'Quelqu''un a répondu à votre commentaire.' end,
        'community_comment',
        jsonb_build_object('kind', 'post', 'postId', NEW.post_id)
      );
    end if;
  end if;

  -- Notifier l'auteur de la publication (sauf si c'est lui qui commente, ou
  -- s'il a déjà été notifié en tant qu'auteur du commentaire parent).
  if v_post_owner is not null
     and v_post_owner <> NEW.user_id
     and (v_parent_owner is null or v_post_owner <> v_parent_owner) then
    insert into public.notifications (user_id, title, message, type, data)
    values (
      v_post_owner,
      case when v_is_doctor then 'Réponse d''un médecin' else 'Nouveau commentaire' end,
      case when v_is_doctor
        then 'Un médecin vérifié a répondu à votre publication.'
        else 'Quelqu''un a commenté votre publication.' end,
      'community_comment',
      jsonb_build_object('kind', 'post', 'postId', NEW.post_id)
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_community_comment on public.community_comments;
create trigger trg_notify_community_comment
  after insert on public.community_comments
  for each row execute function public.notify_on_community_comment();

-- ---------------- Réactions (likes de publication) ----------------
create or replace function public.notify_on_community_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.community_posts where id = NEW.post_id;
  if v_post_owner is not null and v_post_owner <> NEW.user_id then
    insert into public.notifications (user_id, title, message, type, data)
    values (
      v_post_owner,
      'Nouvelle réaction',
      'Votre publication a reçu une réaction.',
      'community_like',
      jsonb_build_object('kind', 'post', 'postId', NEW.post_id)
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_community_like on public.community_likes;
create trigger trg_notify_community_like
  after insert on public.community_likes
  for each row execute function public.notify_on_community_like();
