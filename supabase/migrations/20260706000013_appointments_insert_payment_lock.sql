-- =====================================================
-- Hygiena+ — CORRECTIF SÉCURITÉ : paiement de RDV non falsifiable à la CRÉATION.
--
-- Faille : le durcissement P1 (20260705000005) verrouillait is_paid /
-- amount_paid / paid_at / receipt_number uniquement en UPDATE. La policy
-- d'INSERT (appointments_insert_patient) ne vérifie que patient_id = auth.uid().
-- Une requête cliente forgée pouvait donc CRÉER un rendez-vous is_paid=true,
-- amount_paid arbitraire, receipt_number → reçu « Payé » sans paiement, et
-- déblocage prématuré de la salle de consultation.
--
-- Correctif : trigger BEFORE INSERT qui force les champs de paiement à leurs
-- valeurs neutres pour toute requête API cliente (authenticated/anon, non-admin).
-- Le service_role (webhook de paiement vérifié) et l'admin ne sont pas contraints.
-- Idempotent.
-- =====================================================

create or replace function public.enforce_appointment_insert_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Contextes serveur de confiance / admin : rien à forcer.
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- Une patiente ne peut JAMAIS créer un RDV déjà « payé » : on neutralise
  -- silencieusement les champs de paiement (défense en profondeur, pas d'erreur
  -- bloquante pour une réservation légitime qui ne les fournit pas).
  new.is_paid := false;
  new.amount_paid := null;
  new.paid_at := null;
  new.receipt_number := null;
  -- Un RDV client naît toujours « en attente » (le médecin confirme).
  if new.status is distinct from 'pending' then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_insert_payment on public.appointments;
create trigger trg_appointments_insert_payment
  before insert on public.appointments
  for each row execute function public.enforce_appointment_insert_payment();
