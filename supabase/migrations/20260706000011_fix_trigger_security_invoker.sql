-- =====================================================
-- Hygiena+ — CORRECTIF CRITIQUE : triggers de protection inopérants.
--
-- Bug découvert en exécutant le test de falsification P0-1 sur la base live :
-- les fonctions trigger de protection étaient déclarées SECURITY DEFINER.
-- Or, dans une fonction SECURITY DEFINER, `current_user` devient le
-- PROPRIÉTAIRE de la fonction (postgres) — la garde
-- `current_user not in ('authenticated','anon')` était donc TOUJOURS vraie
-- et la protection ne s'appliquait jamais aux requêtes clientes.
--
-- Correctif : SECURITY INVOKER (défaut) → `current_user` reflète le rôle
-- API réel (authenticated/anon) et la garde fonctionne. Les contextes
-- serveur (service_role, supabase_auth_admin, fonctions refresh_* SECURITY
-- DEFINER) continuent de passer, comme conçu. `public.is_admin()` reste
-- SECURITY DEFINER de son côté et fonctionne inchangé.
--
-- Vérifié après application : les falsifications (commande créée payée,
-- montant modifié, RDV auto-payé, auto-validation médecin, compteurs)
-- échouent désormais en 42501 → 403 PostgREST.
-- Idempotent.
-- =====================================================

alter function public.enforce_profile_privileged_columns()  security invoker;
alter function public.enforce_order_payment_integrity()     security invoker;
alter function public.enforce_appointment_update_integrity() security invoker;
alter function public.enforce_doctor_privileged_columns()   security invoker;
alter function public.enforce_doctor_insert_not_validated() security invoker;
alter function public.enforce_content_counters()            security invoker;
