-- =====================================================
-- Hygiena+ — Setup Auth (à exécuter dans SQL Editor)
-- Indispensable pour la création automatique du profil.
-- =====================================================

-- 1) Création automatique du profil à chaque inscription.
--    S'exécute côté serveur, même si l'app se ferme après le signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Policies minimales pour que l'auth fonctionne au runtime.
--    (profiles a déjà ses policies si tu as exécuté le script initial ;
--     ces CREATE sont idempotents grâce au DROP préalable.)

-- profiles : lecture/écriture de son propre profil
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- notifications : chaque utilisateur voit et modifie les siennes
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- =====================================================
-- Note : admin_logs, user_reports, user_suspensions ont
-- RLS activé sans policy => inaccessibles tant que les
-- policies admin ne sont pas ajoutées (module Admin à venir).
-- =====================================================
