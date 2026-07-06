#!/usr/bin/env bash
# =====================================================
# Hygiena+ — P0-1 : test des 4 requêtes de falsification.
#
# Ces tests DOIVENT être exécutés via l'API REST (PostgREST) avec la clé ANON
# et un JWT d'une utilisatrice NORMALE — PAS dans le SQL Editor (qui tourne en
# superuser et contourne la RLS).
#
# Critère de réussite (audit) : les 4 requêtes échouent avec un code HTTP 4xx.
#
# Utilisation :
#   export SUPABASE_URL="https://<ref>.supabase.co"
#   export ANON_KEY="<clé anon>"
#   export USER_JWT="<access_token d'une utilisatrice connectée, role=user>"
#   export USER_ID="<son id>"
#   export ORDER_ID="<id d'une de ses commandes existantes>"   # pour le test 4
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

echo "== 1) profiles.is_premium auto-accordé =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$API/profiles?id=eq.$USER_ID" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"is_premium": true}')
check "PATCH profiles is_premium=true" "$code"

echo "== 2) subscription_payments inséré par la cliente =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$API/subscription_payments" \
  -H "$H_ANON" -H "$H_AUTH" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_ID\",\"amount\":1,\"plan\":\"Premium\"}")
check "POST subscription_payments" "$code"

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
