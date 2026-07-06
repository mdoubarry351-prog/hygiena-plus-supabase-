-- =====================================================
-- Hygiena+ — CORRECTIF SÉCURITÉ : anonymat des commentaires.
--
-- Faille : contrairement aux publications (lues via la vue sécurisée
-- community_posts_safe qui masque user_id des posts anonymes), les commentaires
-- étaient lus DIRECTEMENT depuis public.community_comments (policy
-- comments_select_all) en joignant profiles(full_name) — même sur les lignes
-- anonymes. L'UI affichait « Anonyme » mais le vrai user_id + nom transitaient
-- dans la réponse réseau → désanonymisation triviale.
--
-- Correctif : une vue community_comments_safe qui met user_id à NULL pour un
-- commentaire anonyme (sauf pour son auteur ou un admin), sur le modèle exact
-- de community_posts_safe. Le client lit désormais cette vue.
--
-- Bonus : colonne is_mine (calculée serveur) ajoutée aux DEUX vues, pour que le
-- client sache reconnaître SES propres contenus anonymes (afin d'offrir
-- Modifier/Supprimer) sans jamais exposer l'identité des autres.
-- Idempotent.
-- =====================================================

-- 1) Vue sécurisée des commentaires (anonymat garanti côté SQL).
create or replace view public.community_comments_safe as
  select
    id,
    post_id,
    content,
    is_anonymous,
    created_at,
    updated_at,
    parent_comment_id,
    likes_count,
    case
      when is_anonymous = true and user_id <> auth.uid() and not public.is_admin()
        then null::uuid
      else user_id
    end as user_id,
    (user_id = auth.uid()) as is_mine
  from public.community_comments;

grant select on public.community_comments_safe to authenticated, anon;

-- 2) is_mine sur la vue des publications (même besoin, côté posts anonymes).
create or replace view public.community_posts_safe as
  select
    id,
    content,
    is_anonymous,
    likes_count,
    created_at,
    updated_at,
    case
      when is_anonymous = true and user_id <> auth.uid() and not public.is_admin()
        then null::uuid
      else user_id
    end as user_id,
    category,
    image_url,
    comments_count,
    image_urls,
    ((likes_count + 2 * comments_count + 1)::numeric
      / power(greatest(extract(epoch from now() - created_at) / 3600.0, 0::numeric) + 2::numeric, 1.5)
    )::double precision as hot_score,
    (user_id = auth.uid()) as is_mine
  from public.community_posts;

grant select on public.community_posts_safe to authenticated, anon;
