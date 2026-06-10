-- =====================================================
-- Hygiena+ — RLS module Rendez-vous (doctors + appointments)
-- À exécuter dans Supabase → SQL Editor.
-- Idempotent : ré-exécutable sans risque (drop policy if exists).
-- Suit le pattern de supabase/setup.sql (public.is_admin(), auth.uid()).
-- =====================================================

-- S'assure que RLS est actif (no-op s'il l'est déjà).
alter table public.doctors      enable row level security;
alter table public.appointments enable row level security;

-- -----------------------------------------------------
-- 1. doctors
-- -----------------------------------------------------

-- Lecture des médecins validés par tout utilisateur authentifié.
-- Le médecin voit aussi sa propre ligne même non encore validée ; l'admin voit tout.
drop policy if exists "doctors_select_validated" on public.doctors;
create policy "doctors_select_validated" on public.doctors
  for select to authenticated
  using (is_validated = true or user_id = auth.uid() or public.is_admin());

-- Un médecin gère sa propre ligne (création / mise à jour / suppression). Admin inclus.
drop policy if exists "doctors_manage_own" on public.doctors;
create policy "doctors_manage_own" on public.doctors
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------
-- 2. profiles — lecture du nom/avatar des médecins validés
-- -----------------------------------------------------
-- Nécessaire au fonctionnement du module : la liste des médecins et « Mes
-- rendez-vous » joignent profiles pour afficher le nom du praticien. La policy
-- existante "profiles_select_own_or_admin" limite la lecture à son propre
-- profil ; on autorise donc, en plus, la lecture des profils rattachés à un
-- médecin validé. (Policies permissives : les conditions s'additionnent en OR.)
drop policy if exists "profiles_select_validated_doctor" on public.profiles;
create policy "profiles_select_validated_doctor" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.doctors d
    where d.user_id = profiles.id and d.is_validated = true
  ));

-- -----------------------------------------------------
-- 3. appointments
-- -----------------------------------------------------

-- Patient : lecture de ses propres rendez-vous (admin inclus).
drop policy if exists "appointments_select_patient" on public.appointments;
create policy "appointments_select_patient" on public.appointments
  for select to authenticated
  using (patient_id = auth.uid() or public.is_admin());

-- Patient : création de ses propres rendez-vous uniquement.
drop policy if exists "appointments_insert_patient" on public.appointments;
create policy "appointments_insert_patient" on public.appointments
  for insert to authenticated
  with check (patient_id = auth.uid());

-- Médecin : lecture des rendez-vous qui le concernent
-- (doctor_id pointant vers SA ligne doctors, identifiée par user_id = auth.uid()).
drop policy if exists "appointments_select_doctor" on public.appointments;
create policy "appointments_select_doctor" on public.appointments
  for select to authenticated
  using (exists (
    select 1 from public.doctors d
    where d.id = appointments.doctor_id and d.user_id = auth.uid()
  ));

-- =====================================================
-- Note : l'annulation par le patient et la confirmation/refus par le médecin
-- (UPDATE sur appointments) ne sont pas couvertes ici — à ajouter avec le
-- module Médecin, en suivant le même pattern.
-- =====================================================
