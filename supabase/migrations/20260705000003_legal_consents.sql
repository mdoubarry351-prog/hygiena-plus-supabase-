-- =====================================================
-- Hygiena+ — P0-3 : enregistrement du consentement juridique.
--
-- Trace explicite du consentement de l'utilisatrice aux textes (CGU +
-- confidentialité) : document, VERSION acceptée et DATE. Append-only :
-- on n'écrase jamais un consentement passé (preuve horodatée).
--
-- RLS : chaque utilisatrice insère et lit SES propres consentements ;
-- l'admin peut lire (audit). Aucune mise à jour / suppression cliente.
-- =====================================================

create table if not exists public.legal_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  document    text not null check (document in ('terms', 'privacy')),
  version     text not null,
  accepted_at timestamptz not null default now()
);

alter table public.legal_consents enable row level security;

-- Lecture : ses propres consentements, ou tout pour l'admin.
drop policy if exists "legal_consents_select_own_or_admin" on public.legal_consents;
create policy "legal_consents_select_own_or_admin" on public.legal_consents
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Insertion : uniquement pour soi-même.
drop policy if exists "legal_consents_insert_own" on public.legal_consents;
create policy "legal_consents_insert_own" on public.legal_consents
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Pas de policy UPDATE/DELETE => refus par défaut (append-only). Défense en
-- profondeur : trigger anti-mutation (sauf cascade service_role à la
-- suppression de compte).
create or replace function public.legal_consents_append_only()
returns trigger
language plpgsql
as $$
begin
  -- Contextes serveur autorisés (service_role, cascade suppression de compte).
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  raise exception 'legal_consents est append-only' using errcode = '42501';
end;
$$;

drop trigger if exists trg_legal_consents_append_only on public.legal_consents;
create trigger trg_legal_consents_append_only
  before update or delete on public.legal_consents
  for each row execute function public.legal_consents_append_only();

create index if not exists idx_legal_consents_user on public.legal_consents (user_id);
