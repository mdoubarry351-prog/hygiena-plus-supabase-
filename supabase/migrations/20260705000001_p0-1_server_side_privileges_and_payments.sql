-- =====================================================
-- Hygiena+ — P0-1 : privilèges, abonnements et paiements
--            STRICTEMENT contrôlés côté serveur.
--
-- Objectif audit (critère de réussite) : les quatre requêtes de
-- falsification suivantes, exécutées avec la clé anon (rôle authenticated),
-- doivent échouer avec une erreur HTTP 4xx :
--   1) update profiles      set is_premium = true      where id = auth.uid();
--   2) insert into subscription_payments (...) values (...);   -- par la cliente
--   3) insert into marketplace_orders (..., is_paid) values (..., true);
--   4) update marketplace_orders set total_amount = 1 where id = <sa commande>;
--
-- Principe OWASP : ne jamais faire confiance au client pour les
-- autorisations, les paiements, les abonnements. Seul le service_role
-- (Edge Functions de confiance) ou un admin peuvent muter ces champs.
--
-- Idempotent : ré-exécutable sans risque.
-- Prérequis : la fonction public.is_admin() (security definer) existe déjà.
-- =====================================================

-- ============================================================
-- 1) profiles : is_premium et role IMMUABLES côté client.
--    (Mass-assignment de propriétés sensibles bloqué au niveau ligne.)
-- ============================================================
create or replace function public.enforce_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seules les requêtes API CLIENTES (rôles authenticated/anon) sont
  -- contraintes. Les contextes serveur passent : service_role (Edge Functions),
  -- fonctions SECURITY DEFINER (exécutées en tant que propriétaire) et
  -- cascades auth (supabase_auth_admin, sans JWT).
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.is_premium is distinct from old.is_premium then
    raise exception 'is_premium ne peut être modifié que par le serveur'
      using errcode = '42501';  -- insufficient_privilege -> PostgREST 403
  end if;

  if new.role is distinct from old.role then
    raise exception 'role ne peut être modifié que par le serveur'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_privileged_columns on public.profiles;
create trigger trg_profiles_privileged_columns
  before update on public.profiles
  for each row execute function public.enforce_profile_privileged_columns();

-- WITH CHECK sur la policy d'update (défense en profondeur, périmètre par ligne).
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ============================================================
-- 2) subscription_payments : append-only, écriture serveur/admin uniquement.
--    (Historique financier infalsifiable.)
-- ============================================================
alter table public.subscription_payments enable row level security;

-- Lecture : sa propre historique, ou tout pour l'admin.
drop policy if exists "subpay_select_own_or_admin" on public.subscription_payments;
create policy "subpay_select_own_or_admin" on public.subscription_payments
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Insertion : réservée à l'admin. (Le service_role contourne la RLS ; c'est le
-- chemin normal via l'Edge Function premium-subscribe.) La cliente ne peut PAS
-- insérer -> aucune policy insert pour le cas général -> refus (403).
drop policy if exists "subpay_insert_admin" on public.subscription_payments;
create policy "subpay_insert_admin" on public.subscription_payments
  for insert to authenticated
  with check (public.is_admin());

-- Pas de policy UPDATE/DELETE => refusées par défaut pour tout rôle non-service.
-- Défense en profondeur : trigger anti-mutation (append-only strict), sauf
-- suppression en cascade par le service_role (suppression de compte).
create or replace function public.subscription_payments_append_only()
returns trigger
language plpgsql
as $$
begin
  -- Contextes serveur autorisés (service_role, cascade de suppression de
  -- compte via supabase_auth_admin) ; requêtes API clientes refusées.
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  raise exception 'subscription_payments est append-only (historique financier)'
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_subpay_append_only on public.subscription_payments;
create trigger trg_subpay_append_only
  before update or delete on public.subscription_payments
  for each row execute function public.subscription_payments_append_only();

-- ============================================================
-- 3) marketplace_orders : is_paid / paid_at / montant non falsifiables.
-- ============================================================
create or replace function public.enforce_order_payment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service de confiance / contexte serveur / admin : intégralité autorisée
  -- (validation paiement, changement de statut, cascades, etc.).
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- La cliente ne peut JAMAIS créer une commande déjà « payée ».
    if coalesce(new.is_paid, false) is true or new.paid_at is not null then
      raise exception 'Une commande ne peut pas être créée comme payée côté client'
        using errcode = '42501';
    end if;
    if coalesce(new.total_amount, 0) < 0 then
      raise exception 'Montant de commande invalide' using errcode = '22003';
    end if;
    return new;
  end if;

  -- UPDATE par la cliente : champs financiers / identité IMMUABLES.
  -- (Seul le statut « cancelled » reste permis via orders_update_own.)
  if new.is_paid      is distinct from old.is_paid
     or new.paid_at   is distinct from old.paid_at
     or new.total_amount is distinct from old.total_amount
     or new.items     is distinct from old.items
     or new.user_id   is distinct from old.user_id then
    raise exception 'Champs protégés de la commande non modifiables côté client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_payment_integrity on public.marketplace_orders;
create trigger trg_orders_payment_integrity
  before insert or update on public.marketplace_orders
  for each row execute function public.enforce_order_payment_integrity();

-- =====================================================
-- REMARQUE (limite connue, à compléter avec le fournisseur de paiement) :
-- La validation du MONTANT à la création (total_amount == somme serveur des
-- prix produits) nécessite une Edge Function de checkout qui recalcule le
-- panier à partir de marketplace_products. Tant que le paiement est simulé
-- (COD / Mobile Money), le trigger empêche déjà : commande créée « payée »,
-- et toute modification du montant / is_paid après création. Le passage au
-- paiement réel (Orange Money / MTN) devra recalculer le total côté serveur
-- et ne flipper is_paid qu'après vérification cryptographique du webhook.
-- =====================================================
