# P0-6 — Versionner la sécurité serveur existante (action propriétaire)

L'audit exige que **toute** la sécurité serveur soit dans Git. Une partie a été
créée dans ce dépôt (voir plus bas). Mais le **schéma préexistant** (tables,
triggers historiques, `public.is_admin()`, politiques RLS créées jadis via le
SQL Editor) vit **uniquement dans la base live**. Il faut l'exporter.

> ⚠️ À exécuter par le **propriétaire** : je ne dois pas installer/lier la CLI
> avec des identifiants moi-même. Les commandes ci-dessous sont exactes.

## 1. Installer et lier la CLI

```bash
brew install supabase/tap/supabase          # ou : npm i -g supabase
supabase login                              # ouvre le navigateur
cd /Users/mamadoubarry/Downloads/hygiena-plus
supabase link --project-ref <PROJECT_REF>   # ref du dashboard (Settings → General)
```

## 2. Exporter le schéma existant (triggers, is_admin(), RLS préexistants)

```bash
supabase db pull                            # crée une migration = schéma live actuel
# La migration générée doit précéder mes migrations 2026070500000x_*.
# Renommer si besoin pour garder l'ordre chronologique (timestamp antérieur).
```

Vérifier que le fichier généré contient bien :
- la fonction `public.is_admin()` (security definer) ;
- le trigger `on_auth_user_created` + `handle_new_user()` ;
- les politiques RLS préexistantes (profiles, doctors, appointments, community,
  marketplace, etc.).

## 3. Télécharger les Edge Functions déployées

```bash
supabase functions download admin-user-actions
supabase functions download consultation-room
# (premium-subscribe et payment-webhook sont DÉJÀ dans le dépôt : supabase/functions/)
```

Commiter le résultat.

## 4. Durcissement SSRF de `consultation-room` (à vérifier/corriger sur la version téléchargée)

Le client refuse déjà toute URL de salle hors `*.daily.co`
(`src/lib/call-service.ts` → `isAllowedDailyRoomUrl`). La même règle DOIT
exister **côté serveur** :

- La fonction ne doit JAMAIS `fetch()` une URL fournie par le client.
- Le nom de la salle doit être **dérivé de l'`appointmentId`** (après avoir
  vérifié que l'appelant est bien un participant du RDV), jamais du body.
- Tout appel à l'API Daily doit cibler exclusivement `https://api.daily.co`.
- Ne renvoyer au client qu'une `roomUrl` du domaine `*.daily.co`.

## 5. Vérifier que l'Edge Function admin applique bien `is_admin()` (P1)

Sur `admin-user-actions` téléchargée : confirmer qu'elle vérifie le rôle admin
(via `is_admin()` ou lecture du profil) AVANT toute action privilégiée, et
qu'elle n'agit pas sur la seule foi du JWT.

---

## Déjà versionné dans ce dépôt (créé pendant la remédiation)

**Migrations** (`supabase/migrations/`) — à appliquer dans l'ordre :
- `20260705000001_p0-1_server_side_privileges_and_payments.sql` — triggers +
  RLS is_premium/role/subscription_payments/marketplace_orders.
- `20260705000002_payment_webhook_events.sql` — table anti-rejeu paiements.
- `20260705000003_legal_consents.sql` — consentement juridique append-only.

**Edge Functions** (`supabase/functions/`) :
- `premium-subscribe/` — activation Premium de confiance.
- `payment-webhook/` — webhook Orange/MTN (vérif HMAC, anti-rejeu).

**Scripts SQL historiques** (déjà présents) : `setup.sql`, `admin-rls.sql`,
`doctor-rls.sql`, `appointments-rls.sql`, `order-tracking.sql`,
`push-notifications.sql`, `review-reminder.sql`.
