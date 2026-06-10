-- =====================================================
-- Hygiena+ — Seed : notifications de test
-- À exécuter dans Supabase → SQL Editor.
-- Idempotent : ré-exécutable sans créer de doublon (les notifications de test
-- précédentes, marquées type = 'seed_test', sont supprimées puis recréées).
--
-- Destinataire : modifie v_email ci-dessous pour cibler le compte que tu testes.
-- Par défaut : le compte patient de test patient.test@hygiena.plus.
-- =====================================================

do $$
declare
  v_email   text := 'patient.test@hygiena.plus';
  v_user_id uuid;
begin
  -- Résout le compte destinataire à partir de son e-mail.
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    raise exception
      'Aucun compte trouvé pour %. Renseigne v_email avec un e-mail existant (compte créé via l''app).',
      v_email;
  end if;

  -- Idempotence : on retire les notifications de test précédentes de ce compte.
  delete from public.notifications
   where user_id = v_user_id and type = 'seed_test';

  -- Insère un échantillon varié (mélange lues / non lues, dates échelonnées).
  insert into public.notifications (user_id, title, message, type, is_read, created_at) values
    (v_user_id,
     'Rendez-vous confirmé',
     'Votre rendez-vous avec Dr Amina Diallo (Gynécologie) du 16/06/2026 à 10:00 a été confirmé.',
     'seed_test', false, now() - interval '8 minutes'),

    (v_user_id,
     'Nouvelle réponse dans la communauté',
     'Une membre a répondu à votre publication « Conseils pour les crampes ». Touchez pour la lire.',
     'seed_test', false, now() - interval '3 hours'),

    (v_user_id,
     'Rappel de cycle',
     'Vos prochaines règles sont estimées dans 3 jours. Pensez à préparer vos protections.',
     'seed_test', true, now() - interval '1 day'),

    (v_user_id,
     'Commande en route',
     'Votre commande de la boutique a été expédiée et arrive bientôt. Merci pour votre achat !',
     'seed_test', true, now() - interval '4 days');

  raise notice 'Notifications de test créées pour % (user_id=%)', v_email, v_user_id;
end $$;

-- Vérification : doit renvoyer 4 lignes (2 non lues en premier, plus récentes en tête).
select n.title, n.is_read, n.created_at
from public.notifications n
join auth.users u on u.id = n.user_id
where u.email = 'patient.test@hygiena.plus'
  and n.type = 'seed_test'
order by n.created_at desc;
