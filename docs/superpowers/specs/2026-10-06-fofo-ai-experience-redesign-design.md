# Fofo AI — Refonte complète de l'expérience (Phase 1.5)

**Statut :** décisions prises avec le porteur de produit le 2026-10-06, puis consigne explicite « ne plus poser de
questions, tout construire et vérifier que ça marche ». Les choix non tranchés par lui sont listés en §12
(« Choix par défaut ») pour qu'il puisse les corriger.

**Spec parente :** `2026-09-26-fofo-ai-phase1-design.md` (§1 positionnement, §4 pipeline, §8 Fon, §9 sécurité
restent en vigueur ; ce document remplace §6 pages et §7 design system).

## 1. Intention

Retour du porteur après le premier test : l'interface est « horrible » et la réinitialisation du mot de passe ne
marche pas. Il veut une expérience **au niveau de Suno**, reconstruite de zéro, tout en gardant l'identité Fofo
(rythmes du Bénin, logo noir et or) et un **focus Fon** (culture, artistes, vidéos de référence).

**Ce qui est reconstruit :** toute la couche expérience (pages, composants, design system, lecteur, parcours).
**Ce qui est conservé :** le moteur (pipeline de génération, RPC et RLS de la migration 0005, stockage privé,
limites, tests d'intégration existants). On ne réécrit pas du code sûr et testé.

## 2. Critères de succès

1. Un nouveau visiteur comprend Fofo en 5 secondes et lance sa première création en moins d'une minute.
2. Tout fonctionne sur téléphone (largeur 360 px) comme sur ordinateur.
3. Chaque parcours est vérifié dans un vrai navigateur (Playwright, ordinateur + mobile émulé) : accueil →
   inscription → création (fournisseur mock) → écoute dans le lecteur persistant → lien de partage ouvert sans
   compte → bibliothèque → renommer / supprimer → mot de passe oublié de bout en bout → déconnexion.
4. Les captures d'écran de chaque page sont relues avant de déclarer le travail terminé.

## 3. Direction visuelle (validée)

- **Sombre & premium** : fond noir profond, accents dorés en dégradé, texte crème.
- Tokens (`src/app/globals.css`, `@theme`) — jamais de couleur codée en dur dans un composant :
  `ink #0B0B0C` (fond), `panel #151517` (surfaces), `line #26262A` (bordures), `cream #F4EEDF` (texte),
  `muted #A39E92` (texte secondaire), `gold-1 #E2BF6A`, `gold-2 #C9A24B`, `gold-3 #8C6A2F` (dégradé),
  `danger #E5484D`, `success #46A758`.
- Police unique **Noto Sans** (diacritiques Fon). Rayons généreux (12–20 px), ombres douces, halo doré discret.
- Mouvement léger (apparition, lueur sur le bouton Générer, shimmer pendant la création) ; respect de
  `prefers-reduced-motion`.
- **Pochettes par rythme** (dégradés, gratuit, pas d'image IA) : Tchinkounmè rouge-brun/or, Zinli sarcelle/or,
  Toba violet/or ; repli neutre pour un rythme inconnu.
- Logo : `Media/Logo symbol.png` et `logo complet.png` copiés dans `public/brand/` (déjà présents) ; mot-symbole
  « Fofo AI » en dégradé doré quand l'image ne convient pas.

## 4. Structure des pages

| Route | Accès | Contenu |
|---|---|---|
| `/` | public | Héros centré (titre, sous-titre) + **boîte de création** (validé « A centrée ») ; dessous : les 3 étapes, la vitrine des 3 rythmes, une sélection de vidéos de référence |
| `/studio` | connecté | Boîte de création en haut + **grille de pochettes** de ses créations (validé « B ») ; 12 plus récentes + « Tout voir » |
| `/bibliotheque` | connecté | Toutes ses créations en grille, filtre par rythme |
| `/rythmes` | public | Les rythmes en grandes cartes |
| `/rythmes/[slug]` | public | Page culturelle : histoire, région, instruments, **maîtres du rythme**, **vidéos YouTube**, CTA « Créer avec ce rythme » |
| `/t/[token]` | public | Page de partage d'un morceau (lecteur, pochette, « Crée la tienne »), aperçu WhatsApp (Open Graph) |
| `/connexion`, `/inscription` | public | Formulaires redessinés ; `?next=` respecté |
| `/mot-de-passe-oublie` | public | Envoi du lien, **erreurs affichées** |
| `/auth/confirm` | public (route) | Échange `code` ou vérification `token_hash` puis redirection vers `next` |
| `/nouveau-mot-de-passe` | session de récupération | Saisie du nouveau mot de passe |
| `/compte` | connecté | E-mail, changer le mot de passe, se déconnecter |
| `/cgu`, `/confidentialite`, 404 | public | Restylés |

**Coquille :** en-tête (logo, Rythmes, Studio, Bibliothèque, compte ou « Se connecter », CTA doré) ; sur mobile,
une **barre d'onglets en bas** (Créer, Bibliothèque, Rythmes, Compte) ; pied de page ; **lecteur persistant** en
bas de l'écran, au-dessus de la barre d'onglets, qui continue de jouer pendant la navigation.

## 5. Parcours clés

**Création invitée (accueil).** Un visiteur non connecté remplit la boîte et appuie sur Générer : son brouillon
(idée, rythme, ambiance, énergie, durée) est gardé dans `sessionStorage`, il est envoyé sur
`/inscription?next=/studio` ; après l'inscription, le Studio pré-remplit la boîte avec le brouillon et met le
bouton Générer en avant. (Pas de génération automatique : l'utilisateur garde la main sur un acte payant.)

**Création (Studio).** Même boîte, connectée. La nouvelle création apparaît immédiatement en tête de grille avec
un shimmer « Création en cours… », se met à jour par le suivi existant (polling 3 s, reaper) et devient jouable.
En échec : message français existant + bouton « Réessayer » qui pré-remplit la boîte.

**Lecteur persistant.** Un seul élément `<audio>` global (contexte React dans la mise en page racine). Jouer une
pochette la charge via `/api/audio/[jobId]` (déjà sécurisé) ; la liste visible sert de file (suivant/précédent).
Lecture, pause, barre de progression cliquable, durée, partager, télécharger.

**Partage.** Menu d'une création terminée → « Partager » : active le partage (jeton aléatoire de 96 bits), affiche
le lien `/t/<jeton>` avec « Copier » et « WhatsApp ». Désactivable à tout moment (le lien cesse de marcher).
Privé par défaut ; un morceau partagé n'apparaît dans **aucun** flux public.

**Renommer / supprimer.** Titre par défaut = début de l'idée (60 caractères). Renommer : 1 à 80 caractères.
Supprimer (créations terminées, échouées ou annulées) : la création disparaît des listes, son fichier audio est
effacé, son lien de partage cesse de marcher ; la ligne reste en base, masquée, pour que la limite horaire et
l'historique d'usage ne puissent pas être contournés en supprimant.

**Mot de passe oublié.** `/mot-de-passe-oublie` appelle `resetPasswordForEmail` avec
`redirectTo = <origine>/auth/confirm?next=/nouveau-mot-de-passe` et **affiche l'erreur** si Supabase refuse.
`/auth/confirm` accepte `code` (flux PKCE, lien par défaut de Supabase) ou `token_hash` + `type` (modèle d'e-mail
recommandé par Supabase pour le SSR), ouvre la session, redirige vers `next` (chemin interne uniquement).
`/nouveau-mot-de-passe` appelle `updateUser({ password })` puis envoie au Studio.
**Limite connue, hors code :** le service e-mail intégré de Supabase n'envoie qu'aux membres de l'équipe du
projet, 2 e-mails/heure. Le README documente la configuration requise (SMTP personnalisé, URLs de redirection,
modèle d'e-mail) ; les tests passent par un lien de récupération généré côté admin, sans e-mail.

## 6. Focus Fon et pages culturelles

Source : `Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx` fourni par le porteur (descriptions, artistes,
rôles, styles, liens YouTube). Ces contenus sont **repris tels quels** de sa source, jamais inventés.

- Nouvelles colonnes `rhythms.region`, `rhythms.instruments`, description enrichie (feuille « Légende et Infos »).
- Nouvelle table `rhythm_references` : artiste, rôle, style, lien vidéo (YouTube ou chaîne), ordre.
- Vidéos intégrées via `youtube-nocookie.com` derrière une vignette « cliquer pour lire » (aucun cookie YouTube
  avant le clic, page légère sur mobile). Les chaînes (`/@…/videos`) s'ouvrent en lien externe.
- Accueil : vitrine des 3 rythmes + 3 vidéos phares (une par rythme).
- **Interface en Fon :** la règle §8 de la spec parente reste absolue — aucune traduction Fon générée par IA. Le
  sélecteur de langue montre Fon « bientôt disponible » tant que `messages/fon.json` n'est pas fourni par un
  locuteur natif. Les noms propres, lieux, instruments et titres de chansons en Fon issus de la source sont
  affichés avec leurs diacritiques (normalisation NFC à l'affichage, NFD pour la comparaison).
- Mention « en attente de validation par un expert culturel » conservée tant que `cultural_review_status` vaut
  `unverified`.

## 7. Moteur : ajouts minimaux (migration `0006`)

Aucune modification de 0001–0005 (déjà en production). Le runtime n'utilise toujours **jamais** la clé
service-role.

- `generation_jobs` : `title text` (rempli par défaut par un trigger `BEFORE INSERT` à partir du prompt — la
  signature de `create_generation_job` ne change pas), `share_token text unique`, `deleted_at timestamptz`.
- `rename_generation_job(p_job_id, p_title)` — propriétaire, création non supprimée, titre 1–80 caractères.
- `set_generation_job_sharing(p_job_id, p_enabled) returns text` — propriétaire, création `completed` non
  supprimée ; active (nouveau jeton hex de 24 caractères) ou désactive (jeton à `null`).
- `delete_generation_job(p_job_id) returns text` — propriétaire, statut terminal ; pose `deleted_at`, retire le
  jeton, supprime la ligne `audio_assets` et renvoie le chemin de stockage pour que la route efface le fichier
  (devenu « orphelin », donc autorisé par la politique de 0005).
- `get_shared_track(p_token) ` — SECURITY DEFINER, exécutable par `anon` : titre, rythme, durée, format, chemin
  de stockage, uniquement si le jeton existe, la création est terminée et non supprimée.
- Politique Storage `generations: read shared` : lecture d'un objet seulement s'il appartient à une création
  partagée et non supprimée (permet à la route de partage de signer une URL sans service-role).
- `rhythm_references` : RLS, lecture publique si le rythme est publié ; colonnes `region`, `instruments` ;
  données issues du tableur du porteur.
- Les listes (Studio, Bibliothèque) excluent `deleted_at is not null` ; la limite horaire compte toujours toutes
  les lignes.

Routes : `DELETE /api/generations/[jobId]` (RPC puis suppression du fichier), `POST /api/generations/[jobId]/share`
(activer/désactiver), `PATCH /api/generations/[jobId]` (renommer), `GET /api/share/[token]/audio` (URL signée,
redirection 307, `?download=1` pris en charge). Toutes avec le client Supabase de route existant.

Adaptateur Stable Audio : HTTP 402 (crédits épuisés) → `unavailable` (message « momentanément indisponible »),
détail journalisé.

## 8. Accessibilité

Contrastes AA sur fond sombre, cibles tactiles ≥ 44 px, focus visible doré, libellés sur tous les champs,
`aria-live` pour l'état d'une création, lecteur pilotable au clavier, `<dialog>` natif pour les menus modaux.

## 9. Erreurs

Toute erreur réseau ou serveur s'affiche en français simple (toast ou message en ligne), jamais de texte
technique. Les états vides ont un appel à l'action (« Crée ta première musique »).

## 10. Tests

- Unitaires : contexte du lecteur, pochettes par rythme, titre par défaut, brouillon invité, menus de partage /
  renommage / suppression, pages d'authentification (erreurs affichées), façade vidéo.
- Intégration (vrai serveur mock + vraie base) : RPC de 0006 (propriétaire uniquement, transitions, jeton),
  politique de lecture partagée, lecture publique des références, routes de partage / suppression / renommage.
- E2E (Playwright, ordinateur + Pixel 7 émulé) : le parcours complet du §2, la page de partage en contexte
  anonyme, le mot de passe oublié via un `token_hash` généré par l'API admin (service-role, tests uniquement),
  la redirection des pages protégées.
- Revue visuelle : captures d'écran Playwright de chaque page (ordinateur + mobile), relues avant de conclure.

## 11. Hors périmètre

Connecteur ElevenLabs (clé valide et forfait payant requis — l'API Musique n'est pas incluse dans l'offre
gratuite), flux public / découverte, likes, commentaires, assistant LLM de prompt (prévu plus tard),
suppression de compte, traductions Fon de l'interface (à fournir par un locuteur natif).

## 12. Choix par défaut (pris sans consulter le porteur, sur sa consigne)

1. Studio = 12 créations récentes + « Tout voir » ; Bibliothèque = tout, filtre par rythme.
2. Titre automatique = début de l'idée ; renommer et supprimer disponibles.
3. Suppression « douce » côté base pour ne pas contourner la limite horaire ; le fichier audio est bien effacé.
4. Pas de flux public : partager ≠ publier.
5. Invité : brouillon conservé, pas de génération automatique après l'inscription.
6. Page compte minimale (pas de suppression de compte).
7. Vidéos YouTube intégrées seulement après un clic.
8. Fon : « bientôt disponible » dans le sélecteur ; contenu culturel en Fon uniquement s'il vient de la source.
