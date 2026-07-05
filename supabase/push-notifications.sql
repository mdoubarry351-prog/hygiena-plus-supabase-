-- ============================================================
-- PUSH SERVEUR (appliqué en production le 05/07/2026)
-- Chaque INSERT dans `notifications` envoie automatiquement une
-- push Expo aux appareils de la destinataire (push_tokens).
-- Asynchrone via pg_net, best-effort : ne bloque jamais l'insert.
-- Aucune clé requise : le token Expo est l'identifiant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_expo_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tokens text[];
BEGIN
  SELECT array_agg(token) INTO v_tokens
  FROM push_tokens
  WHERE user_id = NEW.user_id
    AND token LIKE 'ExponentPushToken%';

  IF v_tokens IS NULL OR array_length(v_tokens, 1) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', to_jsonb(v_tokens),
        'title', NEW.title,
        'body', NEW.message,
        'sound', 'default',
        'priority', 'high',
        'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object('type', NEW.type, 'notificationId', NEW.id)
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      timeout_milliseconds := 8000
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.send_expo_push() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_send_expo_push ON public.notifications;
CREATE TRIGGER trg_send_expo_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.send_expo_push();
