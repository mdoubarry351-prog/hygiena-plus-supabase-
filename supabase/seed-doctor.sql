-- =====================================================
-- Hygiena+ — Seed : un médecin de test (validé)
-- À exécuter dans Supabase → SQL Editor, APRÈS appointments-rls.sql.
-- Idempotent : ré-exécutable sans créer de doublon.
--
-- Crée (si absent) un compte Auth de test, son profil (role = 'doctor'),
-- puis une ligne dans doctors avec is_validated = true.
--
-- Identifiants du compte de test (modifiables ci-dessous) :
--   email    : dr.amina@hygiena.plus
--   mot de passe : Test1234!
--
-- Variante : si tu préfères rattacher le médecin à un compte que tu as déjà
-- créé via l'app, remplace la valeur de v_email par cet e-mail. Le bloc
-- réutilisera le compte existant au lieu d'en créer un nouveau.
-- =====================================================

do $$
declare
  v_email   text := 'dr.amina@hygiena.plus';
  v_pass    text := 'Test1234!';
  v_name    text := 'Dr Amina Diallo';
  v_user_id uuid;
begin
  -- 1) Récupère le compte Auth s'il existe déjà.
  select id into v_user_id from auth.users where email = v_email;

  -- 2) Sinon, crée un compte Auth de test (email confirmé) + son identité.
  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', now(), now(), now()
    );
  end if;

  -- 3) Profil : garantit role = 'doctor' et un nom affiché.
  --    (Le trigger handle_new_user a normalement déjà créé la ligne en 'user'.)
  insert into public.profiles (id, email, role, full_name)
  values (v_user_id, v_email, 'doctor', v_name)
  on conflict (id) do update
    set role = 'doctor',
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  -- 4) Ligne doctors validée (insérée une seule fois).
  if not exists (select 1 from public.doctors where user_id = v_user_id) then
    insert into public.doctors (
      user_id, specialty, bio, license_number,
      consultation_fee, is_validated, validated_at
    ) values (
      v_user_id,
      'Gynécologie',
      'Médecin de test pour la démonstration du module Rendez-vous.',
      'TEST-GIN-0001',
      150000,
      true,
      now()
    );
  else
    -- S'assure que le médecin de test reste validé si la ligne existe déjà.
    update public.doctors
      set is_validated = true, validated_at = coalesce(validated_at, now())
      where user_id = v_user_id;
  end if;

  raise notice 'Médecin de test prêt : % (user_id=%)', v_email, v_user_id;
end $$;

-- Vérification : doit renvoyer une ligne « Dr Amina Diallo / Gynécologie ».
select d.id, p.full_name, d.specialty, d.is_validated, d.consultation_fee
from public.doctors d
join public.profiles p on p.id = d.user_id
where p.email = 'dr.amina@hygiena.plus';
