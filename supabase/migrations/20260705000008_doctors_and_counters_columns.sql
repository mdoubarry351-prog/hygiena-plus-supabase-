-- =====================================================
-- Hygiena+ — P2 : restriction des colonnes modifiables restantes.
--
-- Constats (base live) :
--  1) doctors_update_owner_or_admin est par-ligne : un médecin pouvait
--     S'AUTO-VALIDER (is_validated=true), s'attribuer validated_by/at, ou
--     truquer rating_avg / rating_count. Escalade de privilège.
--  2) posts_update_own_or_admin / comments_update_own_or_admin : l'auteur
--     pouvait gonfler likes_count / comments_count (compteurs dérivés,
--     normalement recalculés par les fonctions refresh_* SECURITY DEFINER).
--
-- Garde commune : seules les requêtes API CLIENTES (authenticated/anon) sont
-- contraintes. Les fonctions SECURITY DEFINER (refresh_*), le service_role et
-- les cascades auth s'exécutent sous un autre current_user et passent.
--
-- Idempotent.
-- =====================================================

-- 1) doctors : validation et réputation contrôlées serveur/admin uniquement.
create or replace function public.enforce_doctor_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.is_validated is distinct from old.is_validated
     or new.validated_by is distinct from old.validated_by
     or new.validated_at is distinct from old.validated_at then
    raise exception 'La validation d''un médecin est réservée à l''administration'
      using errcode = '42501';
  end if;

  if new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    raise exception 'La note d''un médecin est calculée par le serveur'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modifiable' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_doctors_privileged_columns on public.doctors;
create trigger trg_doctors_privileged_columns
  before update on public.doctors
  for each row execute function public.enforce_doctor_privileged_columns();

-- Au passage : un INSERT client (au cas où une policy l'autoriserait un jour)
-- ne peut pas naître déjà validé.
create or replace function public.enforce_doctor_insert_not_validated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if coalesce(new.is_validated, false) is true then
    raise exception 'Un médecin ne peut pas être créé déjà validé côté client'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_doctors_insert_not_validated on public.doctors;
create trigger trg_doctors_insert_not_validated
  before insert on public.doctors
  for each row execute function public.enforce_doctor_insert_not_validated();

-- 2) community_posts / community_comments : compteurs dérivés immuables client.
create or replace function public.enforce_content_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'community_posts' then
    if new.likes_count is distinct from old.likes_count
       or new.comments_count is distinct from old.comments_count then
      raise exception 'Compteurs recalculés par le serveur' using errcode = '42501';
    end if;
  elsif tg_table_name = 'community_comments' then
    if new.likes_count is distinct from old.likes_count then
      raise exception 'Compteurs recalculés par le serveur' using errcode = '42501';
    end if;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modifiable' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_posts_counters on public.community_posts;
create trigger trg_posts_counters
  before update on public.community_posts
  for each row execute function public.enforce_content_counters();

drop trigger if exists trg_comments_counters on public.community_comments;
create trigger trg_comments_counters
  before update on public.community_comments
  for each row execute function public.enforce_content_counters();
