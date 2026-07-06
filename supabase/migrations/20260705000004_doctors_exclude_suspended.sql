-- =====================================================
-- Hygiena+ — P1 : un médecin SUSPENDU n'est plus « autorisé ».
--
-- Avant : getDoctors ne filtrait que is_validated=true. Un médecin suspendu
-- (compte auth banni, mais fiche toujours validée) restait listé et
-- réservable/contactable par les patientes. On l'exclut au niveau RLS pour
-- que TOUTES les lectures clientes (liste, détail, communauté) le masquent.
--
-- « Suspendu » = ligne user_suspensions active et non expirée.
-- Idempotent.
-- =====================================================

-- Helper security definer : contourne la RLS admin-only de user_suspensions
-- pour permettre aux politiques de filtrer sans exposer la table.
create or replace function public.is_suspended(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_suspensions s
    where s.user_id = uid
      and s.is_active = true
      and (s.ends_at is null or s.ends_at > now())
  );
$$;

-- doctors : un médecin suspendu n'apparaît plus (sauf pour lui-même / admin).
drop policy if exists "doctors_select_validated" on public.doctors;
create policy "doctors_select_validated" on public.doctors
  for select
  using (
    (is_validated = true and not public.is_suspended(user_id))
    or user_id = auth.uid()
    or public.is_admin()
  );

-- profiles : le profil d'un médecin suspendu n'est plus exposé via la voie
-- « médecin validé » (les autres accès — soi-même, admin — restent gérés par
-- leurs propres policies).
drop policy if exists "profiles_select_validated_doctor" on public.profiles;
create policy "profiles_select_validated_doctor" on public.profiles
  for select
  using (
    exists (
      select 1 from public.doctors d
      where d.user_id = profiles.id
        and d.is_validated = true
        and not public.is_suspended(d.user_id)
    )
  );
