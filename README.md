# Fofo AI

## Setup local

1. `npm install`
2. Base de données Supabase — deux options :
   - **Projet distant existant** (ce qui est utilisé en développement actuellement) : `npx supabase link --project-ref <ref>`, puis `npx supabase db push`. Copie l'URL et les clés du projet (dashboard → Project Settings → API) dans `.env.local` selon `.env.example`.
   - **Supabase local** (nécessite Docker + virtualisation activée) : `npx supabase start` — copie les valeurs affichées dans `.env.local` selon `.env.example`, puis `npx supabase migration up`.
3. `npm run dev`

## Tests

- `npm test` — tests unitaires (Vitest)
- `npm run test:integration` — tests RLS, génération et lecture audio (nécessite `.env.local` renseigné, local ou distant, et un serveur de dev démarré avec le provider mock : `GENERATION_PROVIDER=mock npm run dev` sous Git Bash, `$env:GENERATION_PROVIDER="mock"; npm run dev` sous PowerShell)
- `npm run test:e2e` — parcours auth et studio (Playwright ; démarre lui-même `npm run dev` avec `GENERATION_PROVIDER=mock`, ou réutilise le serveur déjà lancé)
- Les deux suites visent `http://localhost:3000` par défaut ; `TEST_BASE_URL` permet d'en viser un autre.

## Notes de développement

- `mailer_autoconfirm` est activé sur le projet Supabase de dev pour permettre l'inscription sans e-mail de confirmation (le mailer intégré a une limite de 2 e-mails/heure). À revoir avant un lancement public avec un vrai fournisseur SMTP.
- `STABILITY_API_KEY` doit être configurée (localement et sur Vercel) pour que `/api/generate` génère réellement de l'audio. Sans elle, l'API répond `503 { error: "service_unavailable" }` (le studio affiche « Le service de génération est momentanément indisponible. ») sans créer de job, plutôt que de simuler un résultat.
- Les tests d'intégration et e2e de génération exigent `GENERATION_PROVIDER=mock` pour ne jamais consommer de crédits réels. Hors production, chaque réponse de `/api/generate` porte l'en-tête `x-generation-provider` (`mock`, `stable-audio` ou `none`) : les deux suites le vérifient avant toute génération et s'arrêtent avec un message explicite si le serveur n'est pas en mode mock. Next 16 refuse un second `next dev` dans le même projet : arrête un serveur de dev lancé sans le mock avant de lancer les tests.
- `GENERATION_PROVIDER=mock` est ignoré sur un déploiement Vercel de production (`VERCEL_ENV=production`).
- Les transitions d'état des jobs (démarrage, complétion avec l'asset audio et l'enregistrement d'usage, échec, échec des jobs bloqués depuis plus de 5 minutes) passent par des fonctions SQL qui vérifient le propriétaire (migration `0005`) : l'application n'utilise jamais la clé service-role à l'exécution.

## E-mails : mot de passe oublié (à configurer dans Supabase)

Le parcours est complet côté application : le lien reçu par e-mail revient sur `/auth/confirm`, qui ouvre la session de récupération puis affiche `/nouveau-mot-de-passe`. Pour que de vrais utilisateurs reçoivent l'e-mail, trois réglages du **tableau de bord Supabase** sont nécessaires (ils ne sont pas dans le code) :

1. **SMTP personnalisé** — *Authentication → Emails → SMTP Settings*. Le service d'e-mail intégré de Supabase n'envoie qu'aux adresses des membres de l'équipe du projet, avec une limite très basse (2 e-mails/heure). Branche un fournisseur SMTP (plusieurs proposent une offre gratuite) avec une adresse d'expéditeur vérifiée.
2. **URLs de redirection** — *Authentication → URL Configuration* : `Site URL` = l'adresse publique du site ; `Redirect URLs` = `http://localhost:3000/**` et `https://<ton-domaine>/**`. Sans elles, Supabase ignore le lien de retour.
3. **Modèle « Reset password »** (recommandé) — *Authentication → Emails → Templates* : remplace le lien par
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nouveau-mot-de-passe`.
   Ce lien fonctionne même s'il est ouvert sur un autre appareil (le lien par défaut, à code PKCE, exige le même navigateur que la demande).

Les tests e2e n'envoient aucun e-mail : ils génèrent un lien de récupération via l'API admin (service-role, tests uniquement).

## Partage et pages culturelles

- `npx supabase db push` applique la migration `0006` : titres, liens de partage, suppression, contenus des rythmes (région, instruments, maîtres, vidéos — repris tels quels du tableur `Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx`). Sous PowerShell, utiliser `npx.cmd`.
- Un lien de partage (`/t/<jeton>`) est privé à qui le détient : jamais listé, jamais indexé, coupé dès que le partage est arrêté ou la création supprimée.
- `NEXT_PUBLIC_SITE_URL` (ex. `https://fofo.ai`) sert de base aux aperçus de liens (WhatsApp, Open Graph). À définir sur Vercel.

## Fournisseurs de musique

- **Stability (Stable Audio 2.5)** — branché. 20 crédits (~0,20 $) par morceau ; sans crédits, le studio affiche « momentanément indisponible ».
- **ElevenLabs Music** — pas encore branché : l'API Musique est réservée aux offres payantes et la clé doit commencer par `sk_` (celle affichée une seule fois à la création, pas l'identifiant de la liste).
