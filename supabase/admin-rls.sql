-- =====================================================
-- Hygiena+ — RLS espace Admin
-- À exécuter dans Supabase → SQL Editor.
-- Idempotent : ré-exécutable sans risque (drop policy if exists).
-- Utilise la fonction existante public.is_admin() (security definer).
--
-- Donne à l'administrateur l'accès aux tables qu'il gère et qui n'étaient pas
-- encore couvertes. (profiles et doctors incluent déjà « or public.is_admin() »
-- dans leurs policies ; appointments_select_patient aussi → counts OK.)
-- =====================================================

-- S'assure que RLS est actif (no-op s'il l'est déjà).
alter table public.admin_logs           enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders   enable row level security;
alter table public.community_posts       enable row level security;
alter table public.community_comments    enable row level security;
alter table public.community_likes       enable row level security;
alter table public.user_reports          enable row level security;
alter table public.user_suspensions      enable row level security;
alter table public.app_settings          enable row level security;

-- 1) admin_logs : l'admin écrit (journalisation) et lit l'historique.
drop policy if exists "admin_logs_all_admin" on public.admin_logs;
create policy "admin_logs_all_admin" on public.admin_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 2) marketplace_products : l'admin gère tous les produits (actifs ou non).
--    (La lecture publique des produits actifs reste assurée par sa policy dédiée.)
drop policy if exists "products_all_admin" on public.marketplace_products;
create policy "products_all_admin" on public.marketplace_products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 3) marketplace_orders : l'admin lit toutes les commandes et change leur statut.
drop policy if exists "orders_all_admin" on public.marketplace_orders;
create policy "orders_all_admin" on public.marketplace_orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) community_posts / comments / likes : modération (lecture + suppression).
drop policy if exists "posts_all_admin" on public.community_posts;
create policy "posts_all_admin" on public.community_posts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "comments_all_admin" on public.community_comments;
create policy "comments_all_admin" on public.community_comments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "likes_all_admin" on public.community_likes;
create policy "likes_all_admin" on public.community_likes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5) user_reports : l'admin lit et traite les signalements (statut + note).
drop policy if exists "reports_all_admin" on public.user_reports;
create policy "reports_all_admin" on public.user_reports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 6) user_suspensions : l'admin crée / lève les suspensions.
drop policy if exists "suspensions_all_admin" on public.user_suspensions;
create policy "suspensions_all_admin" on public.user_suspensions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 7) app_settings : l'admin lit et modifie les paramètres de l'application.
drop policy if exists "settings_all_admin" on public.app_settings;
create policy "settings_all_admin" on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================
-- Déjà couvert ailleurs (rien à ajouter) :
--   profiles  -> profiles_select_own_or_admin / profiles_update_own_or_admin
--   doctors   -> doctors_select_validated / doctors_manage_own (incluent is_admin)
--   appointments -> appointments_select_patient (inclut is_admin) → counts OK
-- =====================================================
