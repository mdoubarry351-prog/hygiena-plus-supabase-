-- =====================================================
-- Hygiena+ — P2 : limites de taille + types MIME par bucket (côté serveur).
--
-- Constat (base live) : aucun bucket n'avait de file_size_limit ni
-- d'allowed_mime_types → n'importe quel fichier de n'importe quelle taille
-- pouvait être stocké (coût, abus, contenu non-image sous URL publique).
--
-- L'app n'uploade que des JPEG (expo-image-picker, contentType image/jpeg,
-- cf. src/lib/storage.ts). On autorise aussi png/webp pour la marge d'évolution.
-- La validation Storage s'applique à l'API d'upload → contrainte réellement
-- côté serveur (le client ne peut pas la contourner).
--
-- Idempotent.
-- =====================================================

update storage.buckets
   set file_size_limit = 5242880,               -- 5 Mo
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id in ('avatars', 'product-images', 'article-images', 'community-images');

-- KYC (document d'identité/licence, photos parfois plus lourdes) : 10 Mo.
update storage.buckets
   set file_size_limit = 10485760,              -- 10 Mo
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'doctor-kyc';
