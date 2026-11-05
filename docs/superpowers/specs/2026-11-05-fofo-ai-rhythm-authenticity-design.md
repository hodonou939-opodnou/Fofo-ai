# Fofo AI — Rythmes plus fidèles (plans de composition)

**Statut :** construit le 2026-11-05 sur consigne du porteur (« continue », après la proposition A + B ; consigne
permanente : ne pas poser de questions, construire et vérifier). Les choix marqués *(mon choix)* sont à corriger
par le porteur à l'écoute.

## 1. Intention

Retour du porteur : les morceaux générés « ne ressemblent à rien » des rythmes traditionnels. Le vrai remède est un
modèle entraîné sur des enregistrements sous licence (document de licence séparé, sous-projet B). En attendant, ce
changement rapproche ce que le modèle actuel (ElevenLabs) produit de chaque rythme, sans entraînement.

## 2. Ce qui change

1. **Modèle `music_v2_5`** au lieu de `music_v1`, qui est déprécié et retiré le 2027-01-31.
2. **Plan de composition au lieu d'une simple phrase.** Fofo construit un squelette par rythme
   (`src/lib/generation/composition-plan.ts`) : sections (Intro, Groove, Variation, Outro selon la durée),
   styles positifs (identité du rythme, instruments, tempo, mesure, ambiance, énergie) et styles négatifs
   (voix, batterie, synthés, guitare électrique, Afrobeats…, plus ceux du rythme).
3. **Profils de rythme** (`src/lib/generation/rhythm-styles.ts`), en anglais (exigence ElevenLabs ; spec §8 : rien
   n'est composé en fon). Deux sources seulement : le tableur du porteur, et des mesures faites sur ses 60
   enregistrements de référence (tempo, pulsation binaire ou ternaire, spectre). Les enregistrements ne sont jamais
   utilisés pour entraîner quoi que ce soit (pas de licence) ; seuls des faits mesurés en sont tirés.
4. **Le planificateur gratuit** (`POST /v1/music/plan`, sans crédits) reçoit le squelette en
   `source_composition_plan` et l'idée de l'utilisateur ; il ajoute des styles liés à l'idée. `enforcePlan` remet
   sa réponse dans le cadre : mêmes sections et durées, styles de Fofo en premier, styles interdits retirés, pas de
   paroles, pas de référence audio. Réponse malformée ou planificateur en panne : le squelette est composé tel quel.
   Refus du planificateur (`bad_prompt`, ex. nom d'artiste) : refus montré à l'utilisateur, comme avant.

## 3. Profils retenus

| Rythme | Tempo | Mesure | Source de la mesure |
| --- | --- | --- | --- |
| Tchinkounmè | 112 BPM | 12/8 ternaire | Alokpon et Gbètchéou : 10 sur 11 ternaires, 108–123 BPM |
| Toba | 104 BPM | 12/8 ternaire *(mon choix)* | Allèvi et Gbèzé ternaires (96–115) ; les versions gospel sont binaires |
| Zinli | 95 BPM | aucune imposée | Alèkpéhanhou 91–94 ; binaire lent ou ternaire très lent indiscernables |

## 4. Vérification

- Tests unitaires : 292 (40 nouveaux), types et lint propres.
- Essais réels (payants) avec le code du fournisseur : tempo respecté à ±1,5 BPM sur les trois rythmes ;
  60 s générés en 14,5 s (planificateur 4,7 s), loin de la limite de 45 s par tentative.
- Première version : la mesure « 12/8 ternary feel » revenait binaire et « deep low end » rendait le son presque
  uniquement grave. Formulation corrigée : Tchinkounmè sort désormais ternaire (comme Alokpon) ; Toba est à
  mi-chemin. Le son reste plus grave que les références, mais celles-ci contiennent des voix : comparaison imparfaite.

## 5. Limites et suite

- Le modèle ne connaît toujours pas ces rythmes : il les approche par description. L'authenticité réelle demande
  l'entraînement d'un modèle ouvert sur des enregistrements commandés et licenciés (document « Licence des
  rythmes »).
- Chaque descripteur est à confirmer à l'oreille par le porteur, surtout la mesure du Toba et du Zinli.
- Stability (secours) et le fournisseur mock gardent la phrase de `buildPrompt`.
