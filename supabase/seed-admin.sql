-- =====================================================
-- Hygiena+ — Promotion d'un compte en administrateur
-- À exécuter dans Supabase → SQL Editor.
--
-- ⚠️ SÉCURITÉ (P0-4) : ce fichier NE crée PLUS de compte de test et ne
-- contient AUCUN mot de passe. Les anciens identifiants par défaut
-- (admin@hygiena.plus / mot de passe de test) ont été supprimés car ils
-- étaient exposés lorsque le dépôt était public → à considérer comme
-- compromis. Le propriétaire doit, dans le dashboard Supabase :
--   1) créer/normaliser SON compte administrateur via l'application ;
--   2) supprimer tout compte admin@hygiena.plus résiduel en production ;
--   3) faire tourner (rotation) les mots de passe / clés éventuellement exposés.
--
-- Procédure : crée d'abord TON compte via l'application (email + mot de passe
-- fort), puis promeus-le ci-dessous en remplaçant l'e-mail.
-- =====================================================

-- Remplace l'e-mail par celui de TON compte (déjà créé via l'app) :
update public.profiles
   set role = 'admin'
 where email = 'REMPLACER_PAR_TON_EMAIL@exemple.com';

-- Vérification : doit renvoyer la (ou les) ligne(s) admin.
select id, email, full_name, role
from public.profiles
where role = 'admin';
