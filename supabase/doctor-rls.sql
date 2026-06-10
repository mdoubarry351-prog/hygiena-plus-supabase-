-- =====================================================
-- Hygiena+ — RLS espace Médecin (compléments)
-- À exécuter dans Supabase → SQL Editor, APRÈS appointments-rls.sql.
-- Idempotent : ré-exécutable sans risque (drop policy if exists).
--
-- Ajoute ce qui manque pour que le médecin puisse :
--   1. Modifier le statut des rendez-vous qui le concernent (UPDATE appointments).
--   2. Lire le profil (nom, téléphone) de ses patients (SELECT profiles).
-- (La gestion de sa propre fiche doctors est déjà couverte par "doctors_manage_own".)
-- =====================================================

-- 1) appointments : un médecin met à jour les RDV qui le concernent
--    (confirmer / annuler / terminer). Le WITH CHECK empêche de réassigner
--    le RDV à un autre médecin.
drop policy if exists "appointments_update_doctor" on public.appointments;
create policy "appointments_update_doctor" on public.appointments
  for update to authenticated
  using (exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  ));

-- 2) profiles : un médecin lit le profil des patients ayant un RDV avec lui.
--    Nécessaire pour afficher le nom et le téléphone dans la gestion des RDV
--    (la policy "profiles_select_own_or_admin" limite sinon à son propre profil).
drop policy if exists "profiles_select_doctor_patients" on public.profiles;
create policy "profiles_select_doctor_patients" on public.profiles
  for select to authenticated
  using (exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a.doctor_id
    where a.patient_id = profiles.id and d.user_id = auth.uid()
  ));

-- =====================================================
-- Note : le patient peut toujours uniquement lire/créer ses propres RDV
-- (policies de appointments-rls.sql). Cette policy d'UPDATE est restreinte
-- au médecin concerné ; un patient n'est pas couvert ici pour modifier un RDV.
-- =====================================================
