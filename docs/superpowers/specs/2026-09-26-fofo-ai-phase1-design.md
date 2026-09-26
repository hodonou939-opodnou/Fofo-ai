# Fofo AI — Phase 1 : Boucle de création centrale

Statut : validé par le porteur de produit, prêt pour plan d'implémentation.
Périmètre : MVP web (Next.js), pas de packaging Android/iOS, pas de dashboard admin.

## 1. Positionnement produit (approche StoryBrand)

Fofo AI n'est pas présenté comme "une plateforme de génération musicale IA" mais comme un outil qui permet à
l'utilisateur de devenir **le héros** de sa propre création. Cadre narratif (Donald Miller) appliqué au FR comme au Fon :

- **Le héros** : le créateur (musicien, créateur de contenu, entrepreneur culturel) qui veut faire vivre les
  rythmes du Bénin sans avoir besoin d'une formation musicale.
- **Son problème** : créer une musique originale inspirée de sa culture est aujourd'hui complexe, coûteux, ou
  réservé à des professionnels — et les outils IA génériques ne comprennent pas les rythmes béninois.
- **Le guide** : Fofo AI, qui a l'autorité (recherche des rythmes, respect des droits, partenariat technique
  IA) et l'empathie (porté par et pour la culture béninoise).
- **Le plan** (3 étapes, affiché tel quel sur la landing page) : *Choisis ton rythme → Décris ton idée →
  Écoute et télécharge ta création.*
- **L'appel à l'action** : un CTA unique et clair ("Créer ma musique" / en Fon : à fournir par un locuteur
  natif, cf. section 8).
- **Le succès** : l'utilisateur écoute et partage une musique originale, dans sa langue, qui lui ressemble.
- **L'échec évité** : passer à côté de son patrimoine musical faute d'outil accessible.

Toute la copie (landing, onboarding, micro-copie du studio) doit rester simple, sans jargon technique
("modèle de diffusion latente", "conditionnement audio-to-audio", etc. ne doivent jamais apparaître côté
utilisateur). Le vocabulaire technique reste réservé à la documentation interne.

## 2. Périmètre de la Phase 1

Inclus : branding minimal, auth, catalogue des 3 rythmes, studio de création, génération instrumentale via
Stable Audio, stockage audio sécurisé, lecture/téléchargement, bibliothèque personnelle, interface FR + Fon.

Explicitement reporté (specs séparées plus tard) :
- Phase 2 — gestion des références YouTube / dataset & droits, review culturelle formelle.
- Phase 3 — dashboard admin, monitoring des coûts, configuration multi-provider.
- Phase 4 — monétisation (crédits/abonnements).
- Phase 5 — packaging Android (Capacitor) + Play Store.
- Génération vocale en Fon (nécessite validation linguistique avec locuteurs natifs — voir section 9).

## 3. Catalogue de rythmes (contenu de seed)

Toutes les descriptions ci-dessous sont sourcées de recherches web (Wikipedia, Afrisson, YouTube 2026) et
doivent être marquées `cultural_review_status = 'unverified'` en base tant qu'aucun expert culturel désigné
par le porteur de produit ne les a validées. Orthographes alternatives conservées pour la recherche.

| Rythme (slug) | Noms alternatifs | Description (à valider) |
|---|---|---|
| `tchinkounme` | Tchinkoumé, Tchingounmin, Tchinkounmey, **Gota** (nom alternatif du même rythme, pas un instrument distinct) | Rythme mahi de Savalou (Collines). Percussion aquatique (tohoun). Origine funéraire, devenu festif. Modernisé en "Tchink System" par Stan Tohon. |
| `zinli` | Avi Zinli, Zinli rénové | Rythme fon d'Abomey (Zou), créé sous le règne du roi Glèlè (XIXe s.). À l'origine funéraire royal. Instrument principal : kpézin (jarre). Modernisé en "Zinli rénové" par Alèkpéhanhou. |
| `toba` | Toba (souvent associé au Hanyé) | Rythme populaire, influence yoruba-nago. Présent dans les Collines, le Zou, l'Atlantique, le Littoral. Utilisé pour fêtes, mariages, funérailles. |

La liste d'artistes/liens YouTube du fichier `Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx` est conservée
telle quelle comme document source pour la Phase 2 (droits) — **aucun audio n'est téléchargé ou exploité en
Phase 1**.

## 4. Architecture technique

- **Frontend** : Next.js (App Router) + TypeScript + Tailwind, déployé sur Vercel (compte existant).
- **Backend applicatif** : API routes Next.js — pas de service séparé tant qu'aucune inférence GPU
  auto-hébergée n'est nécessaire (monolithe modulaire, cf. principe 8 du brief produit).
- **Données / Auth / Stockage** : Supabase (compte existant) — Postgres, Auth, Storage avec Row Level
  Security, Realtime pour le suivi de statut des jobs.
- **Génération musicale** : Stable Audio 2.5/3 API (Stability AI).
  - Niveau de conditionnement réel en Phase 1 : **Niveau 1** (prompt texte uniquement) car aucun extrait de
    référence autorisé n'est encore disponible (dépend de la Phase 2 / droits).
  - Le pipeline est construit pour accepter un paramètre de référence audio optionnel dès le départ, afin de
    passer au **Niveau 2** (audio-to-audio) sans réécriture, dès que des extraits autorisés existent.
  - Licence Stability : usage commercial gratuit tant que le chiffre d'affaires de Fofo AI reste sous 1M$/an
    — à revérifier avant dépassement de ce seuil.

### Flux de génération (asynchrone)

1. L'utilisateur soumet sa demande depuis le studio → l'API route valide les paramètres (rythme, prompt,
   durée, humeur, énergie) et crée une ligne `generation_jobs` (statut `queued`) avec une clé
   d'idempotence dérivée des paramètres + utilisateur + fenêtre temporelle, pour éviter les doublons sur
   retry réseau.
2. Un Database Webhook Supabase (déclenché sur l'insertion en statut `queued`) appelle une route API Vercel
   dédiée (`/api/jobs/process`).
3. Cette route :
   - passe le job en `processing` ;
   - appelle Stable Audio (le prompt est systématiquement composé en français/anglais — jamais en Fon, car
     la fiabilité de compréhension du Fon par le provider n'est pas documentée) ;
   - à réception : upload l'audio dans Supabase Storage (bucket privé), crée la ligne `audio_assets`
     (format, durée réelle, sample rate, taille), passe le job en `completed` ;
   - en cas d'erreur/timeout : job en `failed` avec message d'erreur exploitable côté UI, pas de retry
     automatique silencieux illimité (une seule retentative avec backoff, puis échec explicite).
4. Le frontend s'abonne au statut du job via Supabase Realtime (fallback : polling léger toutes les 3-5s si
   Realtime indisponible).
5. Le lecteur récupère l'audio via une URL signée expirante (jamais d'URL publique permanente).

Ne jamais afficher un état de succès avant qu'un asset audio valide ne soit réellement stocké et vérifié.

## 5. Modèle de données (Phase 1)

```
profiles
  id (uuid, FK auth.users) PK
  display_name text
  preferred_locale text ('fr' | 'fon') default 'fr'
  created_at timestamptz

rhythms
  id uuid PK
  slug text unique            -- 'tchinkounme' | 'zinli' | 'toba'
  name text
  alternate_names text[]
  description_fr text
  description_fon text null   -- rempli quand la traduction native est fournie
  cultural_review_status text -- 'unverified' | 'reviewed'
  status text                 -- 'draft' | 'published'
  sort_order int
  created_at timestamptz

generation_jobs
  id uuid PK
  user_id uuid FK profiles
  rhythm_id uuid FK rhythms
  prompt text
  mood text
  energy text
  duration_seconds int
  status text                 -- queued | processing | completed | failed | cancelled
  provider text default 'stable-audio'
  idempotency_key text unique
  error_message text null
  created_at timestamptz
  updated_at timestamptz
  completed_at timestamptz null

audio_assets
  id uuid PK
  generation_job_id uuid FK generation_jobs unique
  storage_path text           -- privé, bucket Supabase Storage
  format text
  duration_seconds numeric
  sample_rate int
  file_size_bytes bigint
  created_at timestamptz

usage_records
  id uuid PK
  user_id uuid FK profiles
  generation_job_id uuid FK generation_jobs
  estimated_cost numeric
  created_at timestamptz
```

RLS : un utilisateur ne peut lire/écrire que ses propres `generation_jobs`, `audio_assets`, `usage_records`.
`rhythms` : lecture publique pour les entrées `status = 'published'` uniquement ; écriture réservée au
rôle service (aucune UI admin en Phase 1, seed via migration).

Pas de table `music_library` séparée : la bibliothèque de l'utilisateur est la vue de ses
`generation_jobs` en statut `completed` jointe à `audio_assets`.

## 6. Pages et routes (Phase 1)

Publiques : landing (`/`), détail de rythme (`/rythmes/[slug]`), authentification (`/connexion`,
`/inscription`, `/mot-de-passe-oublie`), confidentialité (`/confidentialite`), CGU (`/cgu`).

Authentifiées : studio (`/studio`), bibliothèque (`/bibliotheque`), profil/compte (`/compte`).

Toute route authentifiée vérifie la session côté serveur (middleware Next.js + vérification Supabase),
jamais uniquement côté client.

## 7. Design system

Palette extraite du logo fourni (`Media/logo complet.png`, `Media/Logo symbol.png`) :

- Noir profond `#111111` (texte, fond sombre)
- Doré/bronze `#C9A24B` → `#8C6A2F` (dégradé, accent — boutons primaires, éléments actifs)
- Fond crème `#F7F3EA` (fond clair par défaut)

Typographie unique : **Noto Sans** (couvre correctement les diacritiques toniques du Fon en plus du
français/anglais — évite de gérer un changement de police selon la langue active).

Toutes les valeurs sont des tokens centralisés (`design-system/tokens.ts` ou équivalent Tailwind theme),
jamais codées en dur dans les composants. Le logo et son usage (espacement minimum, fond autorisé) sont
documentés dans le design system.

## 8. Interface en français et en Fon

- Librairie i18n avec routage par locale, `fr` par défaut, `fon` disponible en sélection utilisateur.
- Le Fon concerne uniquement le **chrome d'interface** (navigation, boutons, libellés, messages d'état) —
  pas le contenu généré par l'IA, pas le champ de prompt créatif envoyé au provider.
- Normalisation NFD systématique des chaînes en Fon pour préserver les diacritiques toniques (recommandation
  du document de référence fourni par le porteur de produit).
- **Les traductions Fon ne sont pas inventées par l'IA.** La structure de clés de traduction est préparée
  avec le français rempli ; un fichier `messages/fon.json` reste à compléter par le porteur de produit ou un
  locuteur natif qu'il désigne. Tant que ce fichier n'est pas fourni, le sélecteur de langue Fon reste
  masqué ou affiche un état "bientôt disponible" — jamais de texte Fon approximatif généré automatiquement.
- Les ressources du document `Ressources_Fon_IA_Modelisation.pdf` (corpus FFR, modèle ASR MMS-Fongbe, etc.)
  sont documentées dans `docs/AI_MUSIC_STRATEGY.md` comme pistes de R&D pour une future génération vocale
  100% Fon (hors périmètre Phase 1, nécessite validation par des locuteurs natifs avant toute implémentation
  — cf. section 6 du brief produit original).

## 9. Sécurité et authentification

Supabase Auth (email/mot de passe). RLS activé sur toutes les tables listées section 5. Clés API Stability
et clé service-role Supabase uniquement côté serveur (variables d'environnement, jamais exposées au client).
Validation des variables d'environnement au démarrage. Rate limiting par utilisateur sur la soumission de
jobs : 10 générations / heure par défaut, valeur centralisée dans la configuration (pas codée en dur dans
la logique métier) pour ajustement facile sans redéploiement majeur.

## 10. Tests (Phase 1)

Couverture prioritaire du parcours critique : inscription/connexion → sélection rythme → soumission job →
validation des paramètres → traitement du webhook → statut mis à jour → asset stocké → lecture/téléchargement
→ apparition en bibliothèque → refus d'accès à un job/asset d'un autre utilisateur (RLS). Plus : paramètres
invalides, erreur provider, timeout, requêtes dupliquées (idempotence), URL signée expirée.
Un provider mock est utilisé pour les tests automatisés et doit être explicitement identifié comme tel —
jamais présenté comme preuve que la génération réelle fonctionne.

## 11. Éléments en attente côté porteur de produit

- Clé API Stability AI (à fournir quand prêt à connecter réellement le provider — en attendant, l'adaptateur
  est codé et testé avec le mock).
- Accès aux projets Supabase et Vercel existants.
- Fichier de traduction Fon (`messages/fon.json`) rempli par un locuteur natif désigné.
- Validation culturelle des descriptions de rythmes (section 3) par un expert désigné.
- Texte final du CTA et de la landing en Fon (approche StoryBrand, section 1).
