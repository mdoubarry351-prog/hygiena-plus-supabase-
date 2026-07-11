# Hygiena+ — Rapport de sécurité récapitulatif (remédiation)

**Date :** 2026-07-05 · **Branche :** `main` (19 commits locaux, non poussés) ·
**Périmètre :** vulnérabilités P0→P3 du brief d'audit · **Projet Supabase :** `iideovxddiytiqxdlwlt` (us-east-2)

> **ADDENDUM 2026-07-06 — Mise en production + suppression du Premium (voir §6 en fin de document).**
> Les 9 migrations et les Edge Functions sont désormais **appliquées/déployées en prod** ;
> le mode Premium a été **définitivement supprimé** ; un **correctif critique**
> (triggers SECURITY DEFINER inopérants) a été découvert par le test de
> falsification et corrigé ; les tests de falsification **passent** désormais.

Légende : ✅ fait & vérifié · 🔴 action PROPRIÉTAIRE requise · ⏳ planifié (tâche à part)

---

## 1. Contrôle avant déploiement — les 13 points

| # | Point de contrôle | État | Détail |
|---|---|---|---|
| 1 | Tous P0 corrigés + revérifiés | ✅ / 🔴 | Code corrigé et vérifié (P0-1→P0-6, commits ci-dessous). 🔴 Les migrations `supabase/migrations/*` et les 4 Edge Functions doivent être **appliquées/déployées en prod** par le propriétaire pour prise d'effet. |
| 2 | `npm audit` sans vuln élevée | ✅ / ⏳ | HIGH `undici` corrigée (override `^6.27.0`, non-breaking). Restent **20 modérées** (js-yaml/postcss/uuid, build-time uniquement, hors bundle mobile) → nécessitent **expo@57 (majeur, breaking)** : ⏳ tâche planifiée à part (voir §4). |
| 3 | SAST (Semgrep) OK | 🔴 | Non exécuté (Semgrep non installé dans cet environnement). À lancer : `semgrep scan --config auto` (ou en CI). Le code a été revu manuellement sur les axes OWASP du brief. |
| 4 | Secrets (Gitleaks) OK | ✅ | `gitleaks` installé ; `.gitleaks.toml` versionné (allowliste la clé *publishable* Supabase — publique par conception ; la clé `service_role` reste détectée). Arbre de travail : **0 fuite**. Aucun secret réel tracké (vérifié : pas de service_role/JWT dans le dépôt ; `.env` gitignoré). |
| 5 | Falsifications paiements/privilèges échouent | ✅ / 🔴 | Verrouillage serveur écrit (RLS WITH CHECK + triggers : `is_premium`, `role`, `subscription_payments` append-only, `marketplace_orders.is_paid/total_amount`, `appointments.is_paid/amount_paid/status`, `doctors.is_validated/rating`, compteurs communauté). 🔴 Après application des migrations, lancer `supabase/tests/p0-1-falsification.sh` → **les 4 requêtes doivent renvoyer 4xx**. |
| 6 | Confirmation e-mail / CAPTCHA / rate limit / politique mdp | ✅ / 🔴 | Côté repo : politique min 8 (recommandé 12), anti-énumération (login/register/forgot/OTP), throttle SMS appareil (60 s + 5/jour). 🔴 Dashboard Supabase → Auth : **confirmation e-mail ON, min password length 8, Leaked password protection ON (constaté OFF), rate limits, CAPTCHA, plafond SMS fournisseur** (voir checklist §3). |
| 7 | Migrations + Edge Functions versionnées | ✅ / 🔴 | 9 migrations + 4 Edge Functions (`premium-subscribe`, `payment-webhook`, `admin-user-actions` v4, `consultation-room` v1 — sources live importées) + `_shared/http.ts` dans Git. 🔴 Le **schéma préexistant** (tables, `is_admin()`, RLS historiques) doit être exporté via `supabase db pull` (procédure exacte : `supabase/SCHEMA_PULL_TODO.md`). |
| 8 | Confidentialité + CGU accessibles avant inscription | ✅ | Routes publiques `/legal/privacy` et `/legal/terms` **hors RoleGuard**, liées depuis l'inscription. Contenu réel (données de santé sensibles, hébergement us-east-2, Supabase + Daily.co, limitation Guinée) marqué **« PROJET — À VALIDER JURIDIQUEMENT »**. 🔴 Validation par un juriste avant publication. Vérifié en preview : lisible sans session. |
| 9 | Consentement enregistré | ✅ | Table append-only `legal_consents` (document + **version** + **date**, RLS propre/admin, anti-mutation) ; consentement posé à l'inscription et écrit dès session active (gère la confirmation e-mail différée). `LEGAL_VERSION` incrémentable. |
| 10 | Export + suppression des données OK | ✅ | Export : `ExportButton`/`csv-export` (réglages). Suppression définitive : `delete_self` via `admin-user-actions` (cascade), conservée et documentée dans la politique. Les triggers append-only laissent passer les cascades serveur (garde `current_user`). |
| 11 | Routes Web /profile /account /settings sans boucle (3 rôles) | ✅ | Groupes `(doctor)`/`(admin)` → segments réels `/doctor/*`, `/admin/*` : plus aucune collision d'URL. Vérifié en preview : chaque chemin résout UN écran, redirection propre vers /login, zéro boucle/erreur console. 🔴 Recette finale connectée avec un compte réel de chaque rôle recommandée. |
| 12 | Confirmations/messages OK sur le Web | ✅ | 100 % des `Alert.alert` (~177) remplacés : `useConfirm` (destructifs), `useToast` (messages), `ActionSheet` (choix multiples). Vérifié : bundle web sans erreur, écrans d'auth fonctionnels. |
| 13 | Builds Web/Android/iOS OK | ✅ / 🔴 | Web : bundle + navigation vérifiés (preview :8083), type-check propre. 🔴 Builds **Android/iOS (EAS)** à lancer par le propriétaire (non exécutables ici) : `eas build --profile preview` sur les deux plateformes avant release. |

**Verdict : NE PAS DÉPLOYER tant que** les migrations/functions ne sont pas appliquées (1), le test des 4 falsifications pas passé (5), les réglages Auth pas activés (6), le `db pull` pas fait (7), les textes juridiques pas validés (8) et les builds natifs pas verts (13).

---

## 2. Commits de la remédiation (ordre chronologique)

| Commit | Sujet |
|---|---|
| `4da1d4f` | **P0-1** : premium/paiements/privilèges strictement contrôlés serveur |
| `9bc0e96` | **P0-2** : suppression des collisions de routes entre les rôles |
| `7082d31` | **P0-4** : suppression des identifiants admin/médecin par défaut des seeds |
| `e22f7e1` | **P0-5** : renforcement auth côté client (politique mdp + anti-énumération) |
| `2f94dd0` | **P0-1 (prod)** : scaffold webhook paiement Orange Money + MTN (HMAC + anti-rejeu) |
| `916471a` | **P0-3** : conformité juridique (confidentialité/CGU publiques + consentement) |
| `14bc572` | **P0-6** : anti-SSRF appel vidéo (whitelist Daily.co) + versionnage sécurité serveur |
| `eb2ba26` | **P1** : exclure les médecins suspendus (RLS) des listes et réservations |
| `b85752a` | **P1** : remplacement des ~177 Alert.alert par composants web-safe |
| `33128f9` | **P1** : durcissement des mises à jour de rendez-vous + RLS versionnée |
| `0f5957d` | **P2** : gitleaks (faux positifs) + correctif npm audit HIGH (undici) |
| `38ca639` | **P2** : revoke EXECUTE anon/PUBLIC sur les RPC SECURITY DEFINER |
| `6be8eac` | **P2** : buckets publics non listables |
| `f8830e9` | **P2** : restriction des colonnes modifiables restantes (doctors, compteurs) |
| `c442d57` | **P2** : normalisation des fuseaux horaires (dates calendaires locales) |
| `b6105b1` | **P2** : limites de taille + validation MIME sur les uploads |
| `4f547e8` | **P2** : CORS + en-têtes de sécurité Edge Functions (+ import sources live) |
| `bd7e554` | **P3** : bornage des requêtes de liste non paginées |
| `cf7ff71` | **P3** : suppression des avertissements de dépréciation (web) |

Vérifications transverses effectuées à chaque lot : type-check TypeScript, scan gitleaks (0 fuite), smoke test du bundle Web sur le preview :8083.

---

## 3. Checklist consolidée — ACTIONS PROPRIÉTAIRE

### A. Base de données & Edge Functions (dashboard / CLI Supabase)
- [ ] **Appliquer les 9 migrations** `supabase/migrations/20260705000001` → `...000009` (dans l'ordre).
- [ ] **Déployer les 4 Edge Functions** : `premium-subscribe`, `payment-webhook`, `admin-user-actions`, `consultation-room` (elles partagent `_shared/http.ts`).
- [ ] **Secrets des Functions** : `ALLOWED_ORIGIN` (domaine web de l'app), `ORANGE_MOMO_WEBHOOK_SECRET`, `MTN_MOMO_WEBHOOK_SECRET`, `DAILY_API_KEY` (existant).
- [ ] **Vérifier** : `bash supabase/tests/p0-1-falsification.sh` → 4×4xx obligatoires.
- [ ] **`supabase db pull`** + `functions download` du schéma historique → commit (procédure : `supabase/SCHEMA_PULL_TODO.md`).
- [ ] Advisor `security_definer_view` sur `community_posts_safe` : à revoir ENSEMBLE (probablement intentionnel pour l'anonymat — ne pas changer sans vérifier).
- [ ] (Optionnel, advisor) déplacer l'extension `pg_net` hors du schéma `public`.

### B. Authentification (dashboard → Auth)
- [ ] **Confirmation e-mail obligatoire** (Confirm email ON).
- [ ] **Minimum password length = 8** (idéalement 12).
- [ ] **Leaked password protection = ON** (constaté OFF sur la base live).
- [ ] **Rate limits** (connexions, envois d'e-mails, SMS) + **CAPTCHA** (Auth → Attack protection).
- [ ] **Plafond SMS quotidien + alertes** chez le fournisseur SMS (anti SMS-bombing serveur).

### C. Comptes & secrets compromis (dépôt anciennement public)
- [ ] **Supprimer en prod** tout compte `admin@hygiena.plus` / `dr.amina@hygiena.plus` (mot de passe `Test1234!` exposé → compromis).
- [ ] Promouvoir TON compte admin (UPDATE unique — `supabase/seed-admin.sql`) et **changer son mot de passe**.
- [ ] **Rotation** : clé `service_role`, clés API/JWT secret Supabase, tokens EAS/Expo, credentials du fournisseur SMS, `DAILY_API_KEY`.
- [ ] Le dépôt **reste privé**. Avant tout push : `gitleaks detect` (config versionnée).

### D. Produit / juridique / builds
- [ ] **Validation juridique** des textes (`src/lib/legal.ts`) — bandeau « PROJET » à retirer seulement après validation ; adresse de contact réelle à confirmer (`LEGAL_CONTACT_EMAIL`).
- [ ] **Contrats Orange Money / MTN** : compléter les blocs `TODO PROVIDER` de `payment-webhook` (format signature, schéma payload, contrôle du montant) — la vérification HMAC + anti-rejeu est déjà en place.
- [ ] **Builds EAS Android + iOS** (`eas build`) et recette connectée des 3 rôles sur `/profile`, `/account`, `/settings`.
- [ ] SAST : `semgrep scan --config auto` (ou intégration CI).

---

## 4. Tâche planifiée à part — upgrade expo@57

**Quoi :** passer `expo` 54 → 57 (+ `@expo/cli`, `@expo/config`, `expo-dev-client`, `expo-splash-screen`, etc.).
**Pourquoi :** seule voie pour éliminer les **20 vulnérabilités modérées** restantes de `npm audit` (js-yaml DoS, postcss XSS, uuid bounds), toutes **transitives de la chaîne de build** (non embarquées dans l'app livrée) — d'où le classement « planifié », pas « bloquant ».
**Pourquoi pas maintenant :** upgrade **majeur/breaking** (`npm audit fix --force`) : nouveau SDK, RN plus récent, risques de régression sur toute l'app.
**Plan proposé :** branche dédiée → `npx expo install expo@^57` + `npx expo install --fix` → correction des breaking changes → type-check + builds EAS dev sur les 3 plateformes → recette complète → merge. À faire APRÈS la mise en production de la présente remédiation.

---

## 5. Constats notables issus de l'inspection de la base LIVE (via MCP)

- `admin-user-actions` (v4) **applique correctement le contrôle admin** (`delete_self` scopé à l'appelant ; toute autre action exige `profiles.role='admin'` → 403). ✅
- `consultation-room` (v1) est **saine côté SSRF** : salle dérivée de l'appointmentId après vérification du participant, appels sortants limités à `api.daily.co`, domaine Daily fixe. Le client re-vérifie par whitelist `*.daily.co`. ✅
- Failles trouvées et corrigées par migration : patiente pouvant se marquer « payée » sur un RDV (`appointments_update_patient` par-ligne) ; médecin pouvant **s'auto-valider** et truquer sa note ; compteurs communauté falsifiables ; buckets publics listables ; RPC exécutables par `anon` ; aucun plafond taille/MIME sur le Storage.
- Les triggers de protection utilisent la garde `current_user NOT IN ('authenticated','anon')` (et non `auth.role()`) afin de ne bloquer **ni** les fonctions `refresh_*` SECURITY DEFINER **ni** les cascades de suppression de compte (`supabase_auth_admin`).

---

## 6. ADDENDUM — 2026-07-06 : mise en production, suppression du Premium, correctif critique

### A. Mise en production effectuée (via MCP Supabase)
- ✅ Les **9 migrations** `20260705000001` → `...000009` sont **appliquées** sur la base live.
- ✅ Edge Functions **déployées** : `admin-user-actions` (v5, CORS/_shared), `consultation-room` (v2, CORS/_shared), `payment-webhook` (v1, nouvelle).
- ⚠️ `payment-webhook` est déployée avec « Enforce JWT » actif (défaut). À l'intégration réelle
  Orange Money / MTN, **désactiver la vérification JWT** pour cette fonction (dashboard →
  Functions → payment-webhook → Enforce JWT OFF) : les fournisseurs n'envoient pas de JWT
  Supabase ; l'authentification est assurée par la signature HMAC.

### B. Suppression COMPLÈTE et DÉFINITIVE du mode Premium (décision produit)
- Migration `20260706000010_remove_premium.sql` (appliquée en prod) : table
  `subscription_payments`, colonne `profiles.is_premium`, colonnes `premium_*` de
  `app_settings`, audience « premium » des broadcasts, métriques premium du dashboard,
  rappels d'expiration, notifications premium, cible « premium » de `payment_events` —
  tout est supprimé. État vérifié avant : 0 abonnée, 0 paiement → aucune perte de données.
- Edge Function `premium-subscribe` **supprimée du dépôt** (elle n'avait jamais été déployée).
- Code client purgé : écran premium, service, écrans admin (abonnements → « Consultations &
  paiements »), réglages, notifications, types. Type-check et bundle web vérifiés.
- Le test 1 (`is_premium`) et le test 2 (`subscription_payments`) du contrôle de
  falsification sont remplacés par : escalade de rôle (`role=admin`) et paiement de RDV
  (`appointments.is_paid`).

### C. 🔴→✅ CORRECTIF CRITIQUE découvert par le test de falsification
En exécutant enfin le test P0-1 sur la base live (simulation du rôle `authenticated` +
claims JWT), la **création d'une commande déjà « payée » a RÉUSSI** : les fonctions
trigger de protection étaient déclarées `SECURITY DEFINER`, or dans une telle fonction
`current_user` devient le propriétaire (`postgres`) — la garde
`current_user not in ('authenticated','anon')` était donc toujours vraie et **aucune des
protections P0-1/P1/P2 par trigger ne s'appliquait réellement**.

Correctif `20260706000011_fix_trigger_security_invoker.sql` (appliqué en prod) : les 6
fonctions trigger (`enforce_profile_privileged_columns`, `enforce_order_payment_integrity`,
`enforce_appointment_update_integrity`, `enforce_doctor_privileged_columns`,
`enforce_doctor_insert_not_validated`, `enforce_content_counters`) passent en
`SECURITY INVOKER`.

**Re-vérification (simulation `authenticated` en SQL, avec rollback)** :
- Falsifications REFUSÉES (42501 → 403) : commande créée payée ; montant/is_paid modifiés ;
  RDV auto-payé ; RDV auto-confirmé par la patiente ; compteur de likes gonflé ;
  escalade de rôle (bloquée aussi par `prevent_role_self_change`).
- Parcours légitimes INTACTS : annulation de RDV par la patiente, modification de son profil.

Il reste recommandé de rejouer `supabase/tests/p0-1-falsification.sh` via l'API REST avec
un vrai JWT utilisateur (chemin PostgREST complet).
