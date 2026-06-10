-- =====================================================
-- Hygiena+ — Seed : un compte administrateur de test
-- À exécuter dans Supabase → SQL Editor.
-- Idempotent : ré-exécutable sans créer de doublon.
--
-- DEUX OPTIONS — choisis-en UNE :
--
--   OPTION A (par défaut, bloc DO ci-dessous) : crée un compte Auth dédié
--   admin@hygiena.plus / Test1234! et force son profil en role = 'admin'.
--   → Pour promouvoir À LA PLACE un compte que tu as déjà créé via l'app,
--     remplace simplement la valeur de v_email ci-dessous par cet e-mail :
--     le bloc réutilisera le compte existant au lieu d'en créer un nouveau.
--
--   OPTION B (tout en bas, commentée) : promotion ultra-simple d'un compte
--   existant via un seul UPDATE, si tu préfères ne pas créer de compte.
-- =====================================================

-- ----------------------------------------------------------------
-- OPTION A — compte admin de test dédié (ou promotion via v_email)
-- ----------------------------------------------------------------
do $$
declare
  v_email   text := 'admin@hygiena.plus';
  v_pass    text := 'Test1234!';
  v_name    text := 'Administrateur Hygiena';
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

  -- 3) Profil : garantit role = 'admin' et un nom affiché.
  --    (Le trigger handle_new_user a normalement déjà créé la ligne en 'user'.)
  insert into public.profiles (id, email, role, full_name)
  values (v_user_id, v_email, 'admin', v_name)
  on conflict (id) do update
    set role = 'admin',
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  raise notice 'Compte admin prêt : % (user_id=%)', v_email, v_user_id;
end $$;

-- ----------------------------------------------------------------
-- OPTION B — promotion d'un compte EXISTANT (alternative simple)
-- ----------------------------------------------------------------
-- Si tu préfères promouvoir un compte que tu as déjà créé via l'app
-- (au lieu de créer admin@hygiena.plus), décommente la ligne ci-dessous
-- en y mettant TON e-mail, et ignore le bloc DO ci-dessus :
--
-- update public.profiles set role = 'admin' where email = 'ton.email@exemple.com';

-- ----------------------------------------------------------------
-- Vérification : doit renvoyer la (ou les) ligne(s) admin.
-- ----------------------------------------------------------------
select id, email, full_name, role
from public.profiles
where role = 'admin';
