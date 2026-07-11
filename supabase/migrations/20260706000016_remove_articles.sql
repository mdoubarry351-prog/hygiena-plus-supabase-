-- =====================================================
-- Hygiena+ — Suppression COMPLÈTE de la fonctionnalité Articles / Bibliothèque.
--
-- Décision produit : l'onglet « Conseils & infos » / bibliothèque d'articles est
-- retiré de l'application. Purge côté base :
--   - table public.articles (0 ligne, aucune FK entrante, aucune fonction
--     dépendante — vérifié avant exécution) ;
--   - policies RLS de storage.objects du bucket public « article-images » ;
--   - bucket « article-images » lui-même (0 objet).
-- Idempotent.
-- =====================================================

-- 1) Table de contenu.
drop table if exists public.articles cascade;

-- 2) Policies Storage du bucket d'images d'articles (si présentes).
drop policy if exists "article_images_public_read"   on storage.objects;
drop policy if exists "article_images_admin_write"   on storage.objects;
drop policy if exists "article_images_admin_update"  on storage.objects;
drop policy if exists "article_images_admin_delete"  on storage.objects;

-- 3) Le bucket « article-images » (vide) doit être supprimé via l'API/dashboard
--    Storage (la suppression directe en SQL est bloquée par une protection
--    Supabase). ACTION PROPRIÉTAIRE : Storage → article-images → Delete bucket.
