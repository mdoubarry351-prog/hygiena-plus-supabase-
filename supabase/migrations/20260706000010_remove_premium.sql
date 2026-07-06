-- =====================================================
-- Hygiena+ — Suppression COMPLÈTE et DÉFINITIVE du mode Premium.
--
-- Décision produit (2026-07-06) : la fonctionnalité Premium est retirée de
-- l'application. Cette migration purge tout ce qui la portait côté base :
--   - table subscription_payments (+ triggers, policies, fonction de notif) ;
--   - colonne profiles.is_premium (+ sa protection dans le trigger P0-1) ;
--   - colonnes premium_* de app_settings ;
--   - audience « premium » des broadcasts admin ;
--   - métriques premium du tableau de bord admin ;
--   - rappels d'expiration premium dans generate_reminders ;
--   - notifications premium existantes ;
--   - cible « premium » des webhooks de paiement (payment_events).
--
-- État vérifié avant exécution : 0 profil is_premium=true,
-- 0 ligne subscription_payments → aucune perte de données réelles.
-- Idempotent.
-- =====================================================

-- ============================================================
-- 1) subscription_payments : table, triggers, policies, fonctions.
-- ============================================================
drop table if exists public.subscription_payments cascade;
drop function if exists public.notify_on_subscription_payment();
drop function if exists public.subscription_payments_append_only();

-- ============================================================
-- 2) profiles.is_premium : d'abord retirer la référence du trigger de
--    protection P0-1 (sinon toute mise à jour de profil casserait), puis
--    supprimer la colonne. `role` reste strictement protégé.
-- ============================================================
create or replace function public.enforce_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seules les requêtes API CLIENTES (authenticated/anon) sont contraintes.
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role ne peut être modifié que par le serveur'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter table public.profiles drop column if exists is_premium;

-- ============================================================
-- 3) app_settings : réglages premium supprimés.
-- ============================================================
alter table public.app_settings
  drop column if exists premium_enabled,
  drop column if exists premium_price,
  drop column if exists premium_duration_days;

-- ============================================================
-- 4) Broadcasts admin : l'audience « premium » disparaît.
-- ============================================================
create or replace function public.admin_broadcast(p_title text, p_message text, p_audience text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_count int;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs.');
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Titre et message requis.');
  end if;
  if p_audience not in ('all', 'user', 'doctor') then
    return jsonb_build_object('ok', false, 'error', 'Public invalide.');
  end if;

  insert into public.notifications (user_id, title, message, type)
  select p.id, p_title, p_message, 'admin_broadcast'
  from public.profiles p
  where case
    when p_audience = 'all' then true
    when p_audience = 'user' then p.role = 'user'
    when p_audience = 'doctor' then p.role = 'doctor'
    else false
  end;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'count', v_count);
end; $$;

create or replace function public.admin_broadcast_count(p_audience text)
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select case when public.is_admin() then (
    select count(*)::int from public.profiles p
    where case
      when p_audience = 'all' then true
      when p_audience = 'user' then p.role = 'user'
      when p_audience = 'doctor' then p.role = 'doctor'
      else false
    end
  ) else 0 end;
$$;

-- ============================================================
-- 5) Tableau de bord admin : plus de compteur ni de revenu premium.
-- ============================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
  v_users int; v_active int; v_doctors_active int;
  v_appts_today int; v_orders_total int; v_orders_pending int;
  v_posts int; v_reports_pending int;
  v_rev_marketplace numeric; v_rev_consultation numeric;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Réservé aux administrateurs.');
  end if;

  select count(*) into v_users from public.profiles;
  select count(*) into v_active from auth.users
    where last_sign_in_at is not null and last_sign_in_at > now() - interval '30 days';
  select count(*) into v_doctors_active from public.doctors where is_validated = true;
  select count(*) into v_appts_today from public.appointments where appointment_date = current_date;
  select count(*) into v_orders_total from public.marketplace_orders;
  select count(*) into v_orders_pending from public.marketplace_orders where status = 'pending';
  select count(*) into v_posts from public.community_posts;
  select count(*) into v_reports_pending from public.user_reports where status = 'pending';

  select coalesce(sum(total_amount), 0) into v_rev_marketplace
    from public.marketplace_orders
    where status <> 'cancelled'
      and created_at >= date_trunc('month', current_date);
  select coalesce(sum(amount_paid), 0) into v_rev_consultation
    from public.appointments
    where is_paid = true
      and coalesce(paid_at, created_at) >= date_trunc('month', current_date);

  v := jsonb_build_object(
    'ok', true,
    'usersTotal', v_users,
    'activeUsers', v_active,
    'doctorsActive', v_doctors_active,
    'appointmentsToday', v_appts_today,
    'ordersTotal', v_orders_total,
    'ordersPending', v_orders_pending,
    'postsCount', v_posts,
    'reportsPending', v_reports_pending,
    'revenueMarketplace', v_rev_marketplace,
    'revenueConsultation', v_rev_consultation,
    'revenueTotal', v_rev_marketplace + v_rev_consultation
  );
  return v;
end;
$$;

-- ============================================================
-- 6) generate_reminders : le bloc « expiration premium » disparaît
--    (cycle, rendez-vous et demandes d'avis conservés à l'identique).
-- ============================================================
create or replace function public.generate_reminders()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  v_next date; v_ovu date; v_fert date; v_clen int;
  v_first_next date; v_late int;
begin
  -- RAPPELS DE CYCLE
  for r in
    select distinct on (mc.user_id)
      mc.user_id as uid, mc.period_start as pstart, mc.period_end as pend,
      coalesce(mc.cycle_length, 28) as clen
    from public.menstrual_cycles mc
    where mc.period_start is not null
    order by mc.user_id, mc.period_start desc
  loop
    v_clen := greatest(r.clen, 20);
    v_first_next := r.pstart + v_clen;
    v_next := r.pstart;
    while v_next < current_date loop v_next := v_next + v_clen; end loop;
    v_ovu := v_next - 14;
    v_fert := v_ovu - 5;

    if v_next - current_date = 3 then
      perform public.notify_once(r.uid, 'cycle_period_soon', 'Tes règles approchent',
        'Tes prochaines règles sont estimées dans 3 jours. Pense à te préparer.');
    end if;
    if v_fert = current_date then
      perform public.notify_once(r.uid, 'cycle_fertile', 'Fenêtre fertile',
        'Ta fenêtre fertile commence aujourd''hui.');
    end if;
    if v_ovu = current_date then
      perform public.notify_once(r.uid, 'cycle_ovulation', 'Ovulation',
        'Ton ovulation est estimée pour aujourd''hui.');
    end if;

    v_late := current_date - v_first_next;
    if v_late in (2, 5) then
      perform public.notify_once(r.uid, 'cycle_period_late', 'Tes règles ont du retard',
        'Tes règles ont ' || v_late || ' jours de retard. Si elles sont arrivées, pense à les enregistrer. Un léger retard est souvent normal.');
    end if;

    if current_date >= r.pstart and current_date <= r.pstart + 7
       and (r.pend is null or current_date <= r.pend) then
      perform public.notify_once(r.uid, 'cycle_log_daily', 'Pense à enregistrer ton cycle',
        'Tes règles sont en cours. Note ton flux, tes symptômes et ton ressenti du jour.');
    end if;
  end loop;

  -- RAPPELS DE RDV (confirmés, prévus demain)
  for r in
    select a.id as aid, a.patient_id as pid, a.appointment_time as atime
    from public.appointments a
    where a.status = 'confirmed' and a.appointment_date = current_date + 1
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.pid and n.type = 'appointment_reminder'
        and n.data->>'appointmentId' = r.aid::text
        and n.created_at::date = current_date
    ) then
      insert into public.notifications (user_id, title, message, type, data)
      values (r.pid, 'Rappel de rendez-vous',
        'Vous avez un rendez-vous demain à ' || to_char(r.atime, 'HH24:MI') || '.',
        'appointment_reminder',
        jsonb_build_object('kind', 'my_appointments', 'appointmentId', r.aid));
    end if;
  end loop;

  -- DEMANDE D'AVIS : commande livrée il y a 2 jours → invitation à noter.
  for r in
    select o.id as oid, o.user_id as uid
    from public.marketplace_orders o
    where o.status = 'completed'
      and o.updated_at::date = current_date - 2
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.uid and n.type = 'order_review'
        and n.data->>'orderId' = r.oid::text
    ) then
      insert into public.notifications (user_id, title, message, type, data)
      values (r.uid, 'Ton avis compte ⭐',
        'Ta commande est bien arrivée ? Prends 30 secondes pour noter tes produits — ça aide toute la communauté.',
        'order_review',
        jsonb_build_object('kind', 'orders', 'orderId', r.oid));
    end if;
  end loop;
end; $$;

-- ============================================================
-- 7) Purge des notifications premium existantes.
-- ============================================================
delete from public.notifications where type in ('premium_payment', 'premium_expiring');

-- ============================================================
-- 8) payment_events : « order » devient la seule cible de paiement valide.
-- ============================================================
delete from public.payment_events where target_type = 'premium';
alter table public.payment_events drop constraint if exists payment_events_target_type_check;
alter table public.payment_events add constraint payment_events_target_type_check
  check (target_type in ('order'));
