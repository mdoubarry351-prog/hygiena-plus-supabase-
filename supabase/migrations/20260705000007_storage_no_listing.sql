-- =====================================================
-- Hygiena+ — P2 : les buckets publics ne sont plus LISTABLES.
--
-- Constat (advisors Supabase) : les 4 buckets publics (article-images,
-- avatars, community-images, product-images) portent une policy SELECT large
-- sur storage.objects → n'importe quel client peut ÉNUMÉRER tous les fichiers
-- (ex. tous les avatars → fuite de méta-données utilisatrices).
--
-- Un bucket PUBLIC sert ses objets par URL publique sans policy SELECT :
-- l'app construit les URLs via getPublicUrl() et n'appelle jamais .list()
-- (vérifié dans src/lib/storage.ts). Supprimer ces policies ne casse donc ni
-- l'affichage ni l'upload (policies INSERT/UPDATE/DELETE conservées).
--
-- doctor-kyc (privé) garde sa policy SELECT restreinte (propriétaire/admin),
-- nécessaire aux URLs signées.
--
-- Idempotent.
-- =====================================================

drop policy if exists "article_images_public_read"  on storage.objects;
drop policy if exists "avatars_public_read"         on storage.objects;
drop policy if exists "community_images_public_read" on storage.objects;
drop policy if exists "product_images_public_read"  on storage.objects;
