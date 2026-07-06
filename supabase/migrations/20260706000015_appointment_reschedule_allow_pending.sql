-- =====================================================
-- Hygiena+ — CORRECTIF : autoriser le REPORT d'un rendez-vous confirmé.
--
-- Bug : le bouton « Reporter » s'affiche pour les RDV pending ET confirmed, et
-- rescheduleAppointment réécrit status='pending'. Or enforce_appointment_update_
-- integrity (P1) n'autorisait la patiente qu'à passer le statut à 'cancelled'
-- → tout report d'un RDV confirmé échouait avec une erreur 403.
--
-- Correctif : la patiente peut désormais passer le statut à 'cancelled' (annuler)
-- OU 'pending' (report → le médecin re-confirmera). Elle ne peut toujours PAS
-- s'auto-confirmer (→ 'confirmed') ni marquer 'completed'. Les protections de
-- paiement/identité restent inchangées. SECURITY INVOKER (cf. correctif 000011).
-- Idempotent.
-- =====================================================

create or replace function public.enforce_appointment_update_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_patient boolean;
  is_doctor  boolean;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- Colonnes de PAIEMENT : immuables côté client (patiente ET médecin).
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

  -- La patiente (qui n'est pas le médecin) ne peut passer le statut qu'à
  -- 'cancelled' (annuler) ou 'pending' (reporter → re-confirmation médecin).
  -- Jamais 'confirmed' / 'completed' (réservés au médecin).
  if is_patient and not is_doctor then
    if new.status is distinct from old.status and new.status not in ('cancelled', 'pending') then
      raise exception 'Le patient ne peut qu''annuler ou reporter le rendez-vous'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
