# Hygiena+ — Socle + Auth

Application Expo (React Native, TypeScript, Expo Router) connectée à Supabase.
Cette première livraison contient **uniquement le socle et l'authentification**.
Les modules Utilisateur / Médecin / Administrateur viennent ensuite.

## Contenu

- Client Supabase typé (`src/lib/supabase.ts` + `database.types.ts`)
- Authentification email / mot de passe (login, register, mot de passe oublié)
- Création automatique du profil via trigger DB
- Gestion de session (persistée et chiffrée via SecureStore sur natif)
- Rôles `user` / `doctor` / `admin` + routage et protection par rôle
- Thème Hygiena+ et composants réutilisables

## Installation

1. `npm install`
2. Copier `.env.example` vers `.env` et renseigner :
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Dans Supabase → SQL Editor, exécuter `supabase/setup.sql`
   (crée le trigger de profil + les policies d'auth de base).
4. `npx expo start`

## Flux d'authentification

- `app/index.tsx` est l'aiguilleur : selon session + rôle, il redirige vers
  `/(auth)/login`, `/(user)`, `/(doctor)` ou `/(admin)`.
- Chaque groupe de rôle est protégé par `<RoleGuard allow="...">`.
- L'inscription crée le compte Auth ; le **trigger** `on_auth_user_created`
  insère la ligne `profiles` avec `role = 'user'` par défaut.
- Pour créer un médecin ou un admin : changer `role` dans la table `profiles`
  (manuellement pour l'instant ; un flux dédié arrivera avec le module Admin).

## Structure

```
app/                  Routes Expo Router (file-based)
  _layout.tsx         Root: AuthProvider + SafeArea + StatusBar
  index.tsx           Aiguilleur session/rôle
  (auth)/             login, register, forgot-password
  (user)/             espace utilisateur (placeholder)
  (doctor)/           espace médecin (placeholder)
  (admin)/            espace admin (placeholder)
src/
  lib/                supabase, database.types, auth-service
  providers/          AuthProvider (session, profil, rôle)
  components/         Button, Input, Card, Screen, Loading, RoleGuard
  theme/              couleurs, espacements, typographie
  utils/              helpers (routage par rôle)
supabase/
  setup.sql           trigger profil + policies auth
```

## Tester les rôles

1. Crée un compte via l'app (rôle `user` par défaut).
2. Dans Supabase, table `profiles`, passe `role` à `doctor` ou `admin`.
3. Déconnecte/reconnecte : tu es routé vers le bon espace.
