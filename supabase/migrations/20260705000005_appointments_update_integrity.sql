-- =====================================================
-- Hygiena+ — P1 : intégrité des mises à jour de rendez-vous.
--
-- Contexte (constaté sur la base live) : la policy appointments_update_patient
-- autorise la patiente à modifier SA ligne, mais au niveau LIGNE seulement —
-- donc TOUTES ses colonnes, y compris is_paid, amount_paid, paid_at,
-- receipt_number et status. Une patiente pouvait donc se marquer « payée » ou
-- forcer status='confirmed'. Mass-assignment (OWASP), même famille que P0-1.
--
-- Correctif : trigger BEFORE UPDATE qui verrouille au niveau COLONNE ce que la
-- RLS ne peut pas (Postgres RLS = par ligne). + on versionne ici les policies
-- UPDATE/DELETE de appointments qui existaient déjà en prod mais pas au dépôt.
--
-- appointment_status : pending | confirmed | cancelled | completed.
-- Idempotent.
-- =====================================================

-- 1) Versionnage des policies UPDATE/DELETE existantes (idempotent).
alter table public.appointments enable row level security;

drop policy if exists "appointments_update_patient" on public.appointments;
create policy "appointments_update_patient" on public.appointments
  for update to authenticated
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());

drop policy if exists "appointments_update_doctor" on public.appointments;
create policy "appointments_update_doctor" on public.appointments
  for update to authenticated
  using (exists (select 1 from public.doctors d where d.id = appointments.doctor_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.doctors d where d.id = appointments.doctor_id and d.user_id = auth.uid()));

drop policy if exists "appointments_delete_patient_or_admin" on public.appointments;
create policy "appointments_delete_patient_or_admin" on public.appointments
  for delete to authenticated
  using (auth.uid() = patient_id or public.is_admin());

-- 2) Trigger d'intégrité colonne par colonne.
create or replace function public.enforce_appointment_update_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_patient boolean;
  is_doctor  boolean;
begin
  -- Service de confiance / admin : tout autorisé (confirmation de paiement, etc.).
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  -- Colonnes de PAIEMENT : immuables côté client (patiente ET médecin).
  -- Seul le serveur (webhook/admin) les modifie, cf. P0-1.
  if new.is_paid        is distinct from old.is_paid
     or new.amount_paid is distinct from old.amount_paid
     or new.paid_at     is distinct from old.paid_at
     or new.receipt_number is distinct from old.receipt_number then
    raise exception 'Champs de paiement du rendez-vous non modifiables côté client'
      using errcode = '42501';
  end if;

  -- Identités immuables.
  if new.patient_id is distinct from old.patient_id
     or new.doctor_id is distinct from old.doctor_id then
    raise exception 'patient_id / doctor_id non modifiables' using errcode = '42501';
  end if;

  is_patient := (old.patient_id = auth.uid());
  is_doctor  := exists (
    select 1 from public.doctors d
    where d.id = old.doctor_id and d.user_id = auth.uid()
  );

  -- La patiente (qui n'est pas le médecin) ne peut QUE passer le statut à
  -- 'cancelled' — jamais 'confirmed' / 'completed' (réservé au médecin).
  if is_patient and not is_doctor then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'Le patient ne peut qu''annuler le rendez-vous'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_update_integrity on public.appointments;
create trigger trg_appointments_update_integrity
  before update on public.appointments
  for each row execute function public.enforce_appointment_update_integrity();
