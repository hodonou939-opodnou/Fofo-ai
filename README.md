# Fofo AI

## Setup local

1. `npm install`
2. Base de données Supabase — deux options :
   - **Projet distant existant** (ce qui est utilisé en développement actuellement) : `npx supabase link --project-ref <ref>`, puis `npx supabase db push`. Copie l'URL et les clés du projet (dashboard → Project Settings → API) dans `.env.local` selon `.env.example`.
   - **Supabase local** (nécessite Docker + virtualisation activée) : `npx supabase start` — copie les valeurs affichées dans `.env.local` selon `.env.example`, puis `npx supabase migration up`.
3. `npm run dev`

## Tests

- `npm test` — tests unitaires (Vitest)
- `npm run test:integration` — tests RLS (nécessite `.env.local` renseigné, local ou distant)
- `npm run test:e2e` — parcours auth (Playwright, nécessite `npm run dev` ou le démarre automatiquement)

## Notes de développement

- `mailer_autoconfirm` est activé sur le projet Supabase de dev pour permettre l'inscription sans e-mail de confirmation (le mailer intégré a une limite de 2 e-mails/heure). À revoir avant un lancement public avec un vrai fournisseur SMTP.
