#!/usr/bin/env bash
# =====================================================
# Hygiena+ — P0-1 : test des 4 requêtes de falsification.
#
# Ces tests DOIVENT être exécutés via l'API REST (PostgREST) avec la clé ANON
# et un JWT d'une utilisatrice NORMALE — PAS dans le SQL Editor (qui tourne en
# superuser et contourne la RLS).
#
# Critère de réussite (audit) : les 4 requêtes échouent avec un code HTTP 4xx.
# (Le mode Premium ayant été supprimé, les anciens tests is_premium /
# subscription_payments sont remplacés par l'escalade de rôle et le paiement
# de rendez-vous — mêmes garanties serveur.)
#
# Utilisation :
#   export SUPABASE_URL="https://<ref>.supabase.co"
#   export ANON_KEY="<clé anon>"
#   export USER_JWT="<access_token d'une utilisatrice connectée, role=user>"
#   export USER_ID="<son id>"
#   export ORDER_ID="<id d'une de ses commandes existantes>"       # pour le test 4
#   export APPOINTMENT_ID="<id d'un de ses rendez-vous existants>" # pour le test 2
#   bash supabase/tests/p0-1-falsification.sh
# =====================================================
set -u
API="$SUPABASE_URL/rest/v1"
H_ANON="apikey: $ANON_KEY"
H_AUTH="Authorization: Bearer $USER_JWT"
PASS=0; FAIL=0

check() { # $1=label  $2=http_code
  if [ "$2" -ge 400 ] && [ "$2" -lt 500 ]; then
    echo "✅ [$2] $1 — falsification refusée (4xx)"; PASS=$((PASS+1))
  else
    echo "❌ [$2] $1 — ATTENDU 4xx, la falsification a réussi !"; FAIL=$((FAIL+1))
  fi
}

echo "== 1) profiles.role auto-promu en admin =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$API/profiles?id=eq.$USER_ID" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"role": "admin"}')
check "PATCH profiles role=admin" "$code"

echo "== 2) appointments : la patiente se marque « payée » =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$API/appointments?id=eq.$APPOINTMENT_ID" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"is_paid": true, "amount_paid": 1}')
check "PATCH appointments is_paid=true" "$code"

echo "== 3) marketplace_orders créée déjà payée =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$API/marketplace_orders" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"items\":[],\"total_amount\":0,\"is_paid\":true}")
check "POST marketplace_orders is_paid=true" "$code"

echo "== 4) marketplace_orders montant modifié après coup =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$API/marketplace_orders?id=eq.$ORDER_ID" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -d '{"total_amount": 1, "is_paid": true}')
check "PATCH marketplace_orders total_amount/is_paid" "$code"

echo "-----------------------------------------"
echo "Résultat : $PASS réussite(s), $FAIL échec(s)."
[ "$FAIL" -eq 0 ] && echo "🎉 P0-1 OK" || { echo "⛔ P0-1 NON conforme"; exit 1; }
