-- =====================================================
-- Hygiena+ — P0-1 (prod) : journal des événements de paiement (anti-rejeu).
--
-- Table technique pour la vérification cryptographique des webhooks
-- Orange Money / MTN Mobile Money. Chaque référence de transaction est
-- unique -> empêche le rejeu (replay) d'un webhook déjà traité.
--
-- Écriture réservée au service_role (Edge Function payment-webhook).
-- Lecture réservée à l'admin. Aucune écriture cliente possible.
-- =====================================================

create table if not exists public.payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null check (provider in ('orange_money', 'mtn_momo')),
  reference    text not null,                    -- référence unique de la transaction
  status       text not null,                    -- 'succeeded' | 'failed' | ...
  amount       numeric not null,
  target_type  text not null check (target_type in ('premium', 'order')),
  target_id    uuid,                             -- user_id (premium) ou order_id
  raw          jsonb,                            -- payload brut (audit)
  created_at   timestamptz not null default now(),
  unique (provider, reference)                   -- anti-rejeu
);

alter table public.payment_events enable row level security;

-- Lecture admin uniquement.
drop policy if exists "payment_events_select_admin" on public.payment_events;
create policy "payment_events_select_admin" on public.payment_events
  for select to authenticated
  using (public.is_admin());

-- Aucune policy insert/update/delete pour authenticated => tout est refusé.
-- Seul le service_role (Edge Function) écrit, en contournant la RLS.

create index if not exists idx_payment_events_target
  on public.payment_events (target_type, target_id);
