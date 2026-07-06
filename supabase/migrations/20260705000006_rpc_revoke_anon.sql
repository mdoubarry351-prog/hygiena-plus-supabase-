-- =====================================================
-- Hygiena+ — P2 : moindre privilège sur les RPC SECURITY DEFINER.
--
-- Constat (advisors Supabase, base live) : toutes les fonctions SECURITY
-- DEFINER du schéma public sont exécutables par le rôle `anon` via
-- /rest/v1/rpc/* (grant EXECUTE à PUBLIC par défaut de Postgres).
--
-- Les fonctions admin_* s'auto-protègent déjà par `if not is_admin()` (vérifié
-- sur la base live) : ce revoke est une défense en profondeur, pas un correctif
-- de faille active. Aucune de ces fonctions n'est appelée sans session dans
-- l'app → retirer `anon` ne casse rien.
--
-- Idempotent.
-- =====================================================

-- Coupe le grant par défaut PUBLIC puis ré-accorde explicitement.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef                        -- SECURITY DEFINER uniquement
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon', fn.sig);
    execute format('grant execute on function %s to authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- Les futures fonctions ne seront plus exécutables par anon/PUBLIC par défaut.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated;
alter default privileges in schema public grant execute on functions to service_role;

-- Exception : handle_new_user est appelée par le trigger auth (supabase_auth_admin).
-- Les triggers s'exécutent avec les droits du propriétaire de la fonction →
-- aucun grant supplémentaire nécessaire. (Note conservée pour la revue.)
