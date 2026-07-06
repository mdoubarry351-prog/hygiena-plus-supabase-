-- =====================================================
-- Hygiena+ — Promotion d'un compte en médecin (validé)
-- À exécuter dans Supabase → SQL Editor, APRÈS appointments-rls.sql.
-- Idempotent : ré-exécutable sans créer de doublon.
--
-- ⚠️ SÉCURITÉ (P0-4) : ce fichier NE crée PLUS de compte de test et ne
-- contient AUCUN mot de passe. Les anciens identifiants par défaut
-- (dr.amina@hygiena.plus / mot de passe de test) ont été supprimés car ils
-- étaient exposés lorsque le dépôt était public → à considérer comme
-- compromis. Supprime tout compte dr.amina@hygiena.plus résiduel en prod.
--
-- Procédure : crée d'abord le compte du médecin via l'application (email +
-- mot de passe fort), puis renseigne son e-mail ci-dessous. Le bloc promeut
-- le profil en 'doctor' et crée/valide sa fiche médecin.
-- =====================================================

do $$
declare
  -- Remplace par l'e-mail du compte médecin (déjà créé via l'app) :
  v_email   text := 'REMPLACER_PAR_EMAIL_MEDECIN@exemple.com';
  v_name    text := 'Dr Amina Diallo';
  v_user_id uuid;
begin
  -- 1) Récupère le compte Auth existant (créé via l'app). Aucune création ici.
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception 'Aucun compte Auth pour % — crée-le d''abord via l''application.', v_email;
  end if;

  -- 2) Profil : promotion en role = 'doctor' et nom affiché.
  insert into public.profiles (id, email, role, full_name)
  values (v_user_id, v_email, 'doctor', v_name)
  on conflict (id) do update
    set role = 'doctor',
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  -- 3) Fiche doctors validée (insérée une seule fois).
  if not exists (select 1 from public.doctors where user_id = v_user_id) then
    insert into public.doctors (
      user_id, specialty, bio, license_number,
      consultation_fee, is_validated, validated_at
    ) values (
      v_user_id,
      'Gynécologie',
      'Médecin pour la démonstration du module Rendez-vous.',
      'TEST-GIN-0001',
      150000,
      true,
      now()
    );
  else
    update public.doctors
      set is_validated = true, validated_at = coalesce(validated_at, now())
      where user_id = v_user_id;
  end if;

  raise notice 'Médecin prêt : % (user_id=%)', v_email, v_user_id;
end $$;

-- Vérification : doit renvoyer la fiche médecin promue.
select d.id, p.full_name, p.email, d.specialty, d.is_validated, d.consultation_fee
from public.doctors d
join public.profiles p on p.id = d.user_id
where p.role = 'doctor';
