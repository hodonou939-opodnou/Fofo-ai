# Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note (2026-10-06):** the product owner asked for no further questions and a complete, verified build.
> The plan author executes it natively (superpowers:executing-plans), so each task pins files, interfaces, tests and
> verification commands; implementation code lives in the commits rather than being duplicated here.

**Goal:** Rebuild the whole Fofo AI experience to a premium, Suno-level standard (dark & gold, persistent player,
share links, Fon cultural rhythm pages, working password reset) on top of the existing, hardened engine.

**Architecture:** Next.js 16 App Router pages rebuilt on a token-based Tailwind v4 design system and a small set of
in-house UI primitives; one client `PlayerProvider` in the root layout owns a single `<audio>` element; engine
additions are one migration (0006) of owner-checked SECURITY DEFINER RPCs plus three thin route handlers, keeping
the no-service-role runtime rule.

**Tech Stack:** Next.js 16.3 (App Router, Route Handlers, `opengraph-image`), React 19.2, Tailwind CSS v4 `@theme`,
Supabase (Postgres RLS, Storage, Auth via `@supabase/ssr`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-fofo-ai-experience-redesign-design.md` (parent:
`2026-09-26-fofo-ai-phase1-design.md`)

## Global Constraints

- Tokens only, no hard-coded colours in components: `night #0F0C09`, `soot #1A1511`, `soot-raised #221C16`, `ember #2E261F`, `ivory #F3EBDD`, `dust #A69A88`, `paper #FBF8F3`, `gold-light #E4C77A`, `gold #C9A24B`, `bronze #8C6A2F`, `oxblood #5C1B12`, `lagoon #0D4343`, `dusk #33194F`, `danger #E5484D`, `success #46A758`.
- Single font: Noto Sans (latin + latin-ext subsets for Fon diacritics).
- Never generate Fon UI text; Fon shows "bientôt disponible" until `messages/fon.json` is supplied by a native speaker.
- Cultural content (descriptions, artists, roles, styles, video links) comes verbatim from `Liste_Rythmes_Tchinkoume_Toba_Zinli_Artistes.xlsx`.
- Runtime never uses `SUPABASE_SERVICE_ROLE_KEY` (tests may).
- Migrations 0001–0005 are live and immutable; all schema changes go in `0006_*`.
- All user-facing copy in simple French, no technical jargon, no provider names.
- Phone-first: every page usable at 360 px wide; tap targets ≥ 44 px; `prefers-reduced-motion` respected.
- Shared tracks never appear in any public listing.
- `?next=` redirects accept internal paths only (start with a single `/`, not `//`).
- Tests that generate must run against a mock-provider server (existing `x-generation-provider` guard).

## Review Focus

- Long titles/prompts and Fon diacritics (e.g. « Mi Nou Mi Ni Mon Midé Gbô », ɖ ɛ ɔ) must not break layouts at 360 px — Task 6 renders a long title in TrackCard tests; Task 12 screenshots mobile pages.
- A share link must stop working the moment sharing is disabled or the track is deleted — Task 9 integration test.
- `?next=//evil.example` or `?next=https://evil.example` must be ignored (fallback `/studio`) — Task 10 unit test of `safeNextPath`.
- Playing a track whose audio is gone (deleted, expired URL) must show a clear error and leave the player usable — Task 3 unit test (audio `error` event → message, not stuck "loading").
- A guest who chooses "Se connecter" instead of "Créer un compte", or whose browser blocks `sessionStorage`, must still reach the Studio with the draft when possible and never crash — Task 4 unit tests.

---

## File Structure

```
supabase/migrations/0006_experience_redesign.sql      rhythm content + references, title/share/delete columns, RPCs, shared-read storage policy
src/app/globals.css                                    design tokens (@theme), base styles, utilities
src/lib/design/rhythm-covers.ts                        slug → cover gradient (+ fallback)
src/lib/auth/safe-next.ts                              safeNextPath()
src/lib/studio/draft.ts                                guest draft save/load/clear (sessionStorage, try/catch)
src/lib/tracks/types.ts                                Track type shared by grid, player, pages
src/lib/tracks/queries.ts                              server helpers: listTracks(), getRhythmsWithReferences()
src/components/ui/{button,field,chip,select,dialog,toast,spinner,logo}.tsx   primitives
src/components/brand/cover.tsx                         rhythm cover art
src/components/layout/{site-header,mobile-tab-bar,site-footer,account-menu}.tsx
src/components/player/{player-provider,player-bar}.tsx global player
src/components/create/creation-box.tsx                 shared creation box (guest + signed-in), replaces generation-form
src/components/tracks/{track-card,track-grid,track-menu,share-dialog}.tsx
src/components/rhythms/{rhythm-card,video-facade,reference-list}.tsx
src/components/auth/{sign-in-form,sign-up-form,forgot-password-form,new-password-form}.tsx
src/app/{page,studio/page,bibliotheque/page,rythmes/page,rythmes/[slug]/page,t/[token]/page,t/[token]/opengraph-image,compte/page,nouveau-mot-de-passe/page,not-found}.tsx
src/app/auth/confirm/route.ts
src/app/api/generations/[jobId]/route.ts               PATCH rename, DELETE
src/app/api/generations/[jobId]/share/route.ts         POST {enabled}
src/app/api/share/[token]/audio/route.ts               GET signed URL redirect (+download)
src/proxy.ts                                           protect /compte, /nouveau-mot-de-passe
```

Removed when replaced: `components/studio/{generation-form,studio-client,job-status,audio-player}.tsx` (logic moves into
creation-box / track-grid / player), old `rhythms/rhythm-card.tsx` markup.

---

### Task 1: Migration 0006 + engine routes groundwork

**Files:** Create `supabase/migrations/0006_experience_redesign.sql`; Test `tests/integration/redesign-rpc.test.ts`;
Modify `src/lib/generation/stable-audio-provider.ts`, `tests/unit/stable-audio-provider.test.ts`.

**Interfaces — Produces (SQL):**
- `generation_jobs.title text`, `.share_token text unique`, `.deleted_at timestamptz`; trigger `generation_jobs_default_title` (BEFORE INSERT: `title := coalesce(nullif(trim(title),''), left(trim(prompt), 60))`).
- `rename_generation_job(p_job_id uuid, p_title text) returns void`
- `set_generation_job_sharing(p_job_id uuid, p_enabled boolean) returns text` (token or null)
- `delete_generation_job(p_job_id uuid) returns text` (storage path or null)
- `get_shared_track(p_token text) returns table(job_id uuid, title text, rhythm_name text, rhythm_slug text, duration_seconds numeric, format text, storage_path text, created_at timestamptz)` — granted to `anon, authenticated`
- storage policy `generations: read shared`; `rhythms.region text`, `rhythms.instruments text[]`; table `rhythm_references(id, rhythm_id, artist, role, style, video_url, sort_order)` public-read when rhythm published; data from the spreadsheet.
- Error codes: `P0002` not found / not owner, `55000` illegal state, `22023` invalid title.

- [ ] Write failing integration tests: owner renames (and 81-char title → 22023); stranger cannot rename/share/delete (P0002); sharing a non-completed job → 55000; enable returns 24-hex token, anon `get_shared_track(token)` returns the row; disable → anon gets 0 rows; delete returns path, job hidden from owner's `deleted_at is null` list, `get_shared_track` returns 0 rows, a second delete → 55000; anon can `select` from `rhythm_references` for a published rhythm; inserted job gets default title from prompt.
- [ ] Run `TEST_BASE_URL=… npm run test:integration -- redesign-rpc` → FAIL (functions missing).
- [ ] Write 0006; validate locally by reading; apply with `npx supabase db push --yes`; confirm dry-run "up to date".
- [ ] Re-run → PASS. Stable Audio: add unit test `402 → kind "unavailable"`, see it fail, map 402 in `failureKindForStatus`, see it pass.
- [ ] Commit `feat(db): migration 0006 — titles, share links, soft delete, rhythm references`.

### Task 2: Design system and primitives

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx` (Noto Sans latin-ext, dark body); Create
`src/lib/design/rhythm-covers.ts`, `src/components/brand/cover.tsx`, `src/components/ui/*.tsx`; Test
`tests/unit/rhythm-covers.test.ts`, `tests/unit/ui-primitives.test.tsx`.

**Produces:** `coverFor(slug: string): { from: string; to: string; glow: string }` (unknown slug → neutral);
`<Cover slug size="sm|md|lg|xl" className />`; `<Button variant="primary|ghost|subtle|danger" size="sm|md|lg" asChild?>`;
`<Field label hint error>{input}</Field>`; `<Chip selected onClick>`; `<Select label options value onChange>`;
`<Dialog open onClose title>`; `useToast()` + `<ToastViewport>`; `<Spinner>`; `<Logo variant="full|symbol|wordmark">`.

- [ ] Failing tests: known slugs map to their palette, unknown → fallback; Button renders variant classes and is disabled-aware; Field wires `label`↔`id` and shows `error` with `role="alert"`; Dialog closes on Escape.
- [ ] Implement tokens (`@theme` colours, radii, shadows, `--font-sans`), primitives, cover.
- [ ] `npm test` PASS, `npm run lint`, commit `feat(ui): dark premium design system and primitives`.

### Task 3: App shell and persistent player

**Files:** Create `src/components/player/player-provider.tsx`, `player-bar.tsx`, `src/components/layout/mobile-tab-bar.tsx`,
`account-menu.tsx`, `src/lib/tracks/types.ts`; Rewrite `site-header.tsx`, `site-footer.tsx`, `language-switcher.tsx`
(keep Fon "bientôt disponible"); Modify `src/app/layout.tsx`; Test `tests/unit/player-provider.test.tsx`,
`tests/unit/site-header.test.tsx` (rewrite), `tests/unit/language-switcher.test.tsx` (keep behaviour).

**Produces:** `type Track = { id: string; title: string; rhythmSlug: string | null; rhythmName: string | null; durationSeconds: number | null; status: "queued"|"processing"|"completed"|"failed"|"cancelled"; errorMessage: string | null; shareToken: string | null; createdAt: string; src?: string }`;
`usePlayer(): { current: Track | null; isPlaying: boolean; error: string | null; position: number; duration: number; play(track: Track, queue?: Track[]): void; toggle(): void; next(): void; previous(): void; seek(seconds: number): void }`. Default `src` = `/api/audio/${id}`.

- [ ] Failing tests: `play()` sets current + calls `audio.play`; `toggle()` pauses; `next()`/`previous()` walk the queue and stop at ends; audio `error` event sets `error` to a French message and `isPlaying=false` (Review Focus); header shows "Se connecter" when signed out and account menu when signed in; tab bar links present.
- [ ] Implement; header is a server component reading the Supabase user; tab bar `md:hidden`; player bar fixed above tab bar, hidden when nothing has played.
- [ ] Tests PASS, lint, commit `feat(shell): header, mobile tab bar, persistent player`.

### Task 4: Creation box (guest + signed-in)

**Files:** Create `src/components/create/creation-box.tsx`, `src/lib/studio/draft.ts`; Delete
`src/components/studio/generation-form.tsx` (+ its test, ported); Test `tests/unit/creation-box.test.tsx`, `tests/unit/draft.test.ts`.

**Consumes:** existing `/api/generate` contract (`rhythmSlug, prompt, mood, energy, durationSeconds, submissionId`; 201 `{jobId}`, 400/401/404/429/503), `MOODS/ENERGIES/DURATIONS/PROMPT_MAX_LENGTH` from `options.ts`.
**Produces:** `<CreationBox rhythms={{slug,name}[]} mode="guest"|"signed-in" initialRhythm? onCreated?(jobId: string, draft: Draft) />`;
`type Draft = { prompt; rhythmSlug; mood; energy; durationSeconds }`; `saveDraft(d)`, `loadDraft(): Draft | null`, `clearDraft()` — all swallow storage errors.

- [ ] Failing tests (ported from generation-form + new): submissionId reuse only after network failure; 429/503/400 French messages; guest submit saves draft and navigates to `/inscription?next=/studio`; guest link "J'ai déjà un compte" goes to `/connexion?next=/studio`; signed-in mount pre-fills from draft then clears it; `sessionStorage` throwing does not crash (Review Focus); prompt `maxLength` 500; rhythm chips select.
- [ ] Implement (Enter+Ctrl/⌘ submits; button shows spinner; aria-live status).
- [ ] Tests PASS, lint, commit `feat(create): shared creation box with guest draft flow`.

### Task 5: Home page

**Files:** Rewrite `src/app/page.tsx`; Create `src/lib/tracks/queries.ts` (`getPublishedRhythms()`,
`getRhythmWithReferences(slug)`, `getFeaturedVideos()`), `src/components/rhythms/rhythm-card.tsx` (rewrite); Update
`src/messages/fr.json`; Test `tests/unit/rhythm-card.test.tsx` (rewrite).

- [ ] Failing test: RhythmCard shows name, region, cover, links to `/rythmes/<slug>`.
- [ ] Implement hero (title « Fais vivre les rythmes du Bénin »), CreationBox (guest or signed-in by session), 3 steps, rhythm showcase, 3 featured videos (first video per rhythm, VideoFacade from Task 8 — build order: implement VideoFacade here and test it in Task 8 file).
- [ ] Tests PASS, lint, commit `feat(home): premium landing with creation box, rhythms and videos`.

### Task 6: Tracks — grid, card, menu, routes, Studio

**Files:** Create `src/components/tracks/{track-card,track-grid,track-menu,share-dialog}.tsx`,
`src/app/api/generations/[jobId]/route.ts`, `src/app/api/generations/[jobId]/share/route.ts`; Rewrite
`src/app/studio/page.tsx`; Delete `components/studio/{studio-client,job-status,audio-player}.tsx` (+ tests, ported);
Test `tests/unit/track-card.test.tsx`, `tests/unit/track-grid.test.tsx`, `tests/unit/track-menu.test.tsx`,
`tests/integration/generations-routes.test.ts`.

**Consumes:** RPCs from Task 1, `usePlayer` (Task 3), `CreationBox` (Task 4), existing stale reaper RPC + polling semantics.
**Produces:** `PATCH /api/generations/:id {title}` → 200 `{title}` | 400 | 404; `DELETE /api/generations/:id` → 204 | 404 | 409; `POST /api/generations/:id/share {enabled:boolean}` → 200 `{shareToken: string|null, url: string|null}` | 404 | 409.

- [ ] Failing unit tests: card shows shimmer + "Création en cours…" for queued/processing, French error + "Réessayer" for failed, play button for completed; very long title truncates (Review Focus); grid polls non-terminal tracks (3 s), stops on terminal, retries with backoff, calls reaper when stale (port job-status tests); menu actions call the routes and update UI; share dialog shows link, copy, WhatsApp `https://wa.me/?text=`.
- [ ] Failing integration tests: routes enforce ownership (404 for stranger), rename validation, delete removes storage object (owner download → 404 afterwards), share toggle round-trip.
- [ ] Implement; Studio = CreationBox + 12 latest (excluding deleted) + "Tout voir"; new job prepended immediately.
- [ ] Tests PASS, lint, commit `feat(studio): cover grid, live status, share/rename/delete`.

### Task 7: Library

**Files:** Rewrite `src/app/bibliotheque/page.tsx`; Test `tests/unit/library-page.test.tsx` (rewrite).
- [ ] Failing test: lists all non-deleted tracks, rhythm filter via `?rythme=`, reaper called before listing, empty state CTA.
- [ ] Implement; tests PASS; commit `feat(library): full grid with rhythm filter`.

### Task 8: Rhythm cultural pages

**Files:** Create `src/app/rythmes/page.tsx`, `src/components/rhythms/{video-facade,reference-list}.tsx`; Rewrite
`src/app/rythmes/[slug]/page.tsx`; Test `tests/unit/video-facade.test.tsx`, `tests/unit/reference-list.test.tsx`.
- [ ] Failing tests: facade shows thumbnail button, loads `https://www.youtube-nocookie.com/embed/<id>?autoplay=1` iframe only after click; channel URLs render as external link (`target=_blank rel=noopener`); reference list groups artist/role/style.
- [ ] Implement; detail page: cover hero, alternate names, region, instruments, story, masters, videos, CTA `/studio?rythme=<slug>` (CreationBox `initialRhythm`), cultural review notice.
- [ ] Tests PASS, commit `feat(rhythms): cultural pages with masters and videos`.

### Task 9: Share page

**Files:** Create `src/app/t/[token]/page.tsx`, `src/app/t/[token]/opengraph-image.tsx`, `src/app/api/share/[token]/audio/route.ts`;
Test `tests/integration/share.test.ts`.
- [ ] Failing integration tests (anonymous fetch): shared token page 200 with title; audio route 307 → signed URL → 200 `audio/*`; after disable → page 404 and audio 404; after delete → 404 (Review Focus); `?download=1` → `Content-Disposition: attachment`.
- [ ] Implement (anon server client, `generateMetadata` with OG title/description, OG image with cover gradient + title).
- [ ] Tests PASS, commit `feat(share): public share page and audio route`.

### Task 10: Auth, password reset, account

**Files:** Rewrite `src/components/auth/{sign-in-form,sign-up-form}.tsx`, `src/app/{connexion,inscription,mot-de-passe-oublie}/page.tsx`;
Create `src/components/auth/{forgot-password-form,new-password-form}.tsx`, `src/app/auth/confirm/route.ts`,
`src/app/nouveau-mot-de-passe/page.tsx`, `src/app/compte/page.tsx`, `src/lib/auth/safe-next.ts`; Modify `src/proxy.ts`;
Test `tests/unit/safe-next.test.ts`, `tests/unit/auth-forms.test.tsx`, `tests/unit/auth-pages-cross-links.test.tsx` (keep), `tests/unit/sign-up-form.test.tsx` (update).
- [ ] Failing tests: `safeNextPath("/studio")="/studio"`, `("//evil.example")`, `("https://evil.example")`, `("/\\evil")`, `(null)` → `"/studio"` (Review Focus); forgot form shows Supabase error text mapped to French and success message only on success; `redirectTo` = `${origin}/auth/confirm?next=/nouveau-mot-de-passe`; new-password form validates length ≥ 8 and match; sign-in/up honour `next`.
- [ ] Implement `/auth/confirm` (code → `exchangeCodeForSession`; `token_hash`+`type` → `verifyOtp`; failure → `/connexion?erreur=lien`), compte page (email, change password, sign out).
- [ ] Tests PASS, commit `feat(auth): redesigned auth, complete password reset, account page`.

### Task 11: Legal, 404, docs, cleanup

**Files:** Restyle `src/app/{cgu,confidentialite}/page.tsx`, create `src/app/not-found.tsx`; Update `README.md` (Supabase e-mail setup: custom SMTP, redirect URLs, recovery template with `token_hash`; provider status: Stability credits, ElevenLabs needs paid key `sk_…`); remove dead files; Test `tests/unit/legal-pages.test.tsx` (keep passing).
- [ ] Implement, `npm test` + lint PASS, commit `chore: restyle legal/404 pages, document e-mail setup`.

### Task 12: End-to-end verification and visual review

**Files:** Rewrite `tests/e2e/*.spec.ts` (auth, studio-guard, studio-generation) + Create `tests/e2e/journey.spec.ts`,
`tests/e2e/password-reset.spec.ts`, `tests/e2e/screenshots.spec.ts`; Modify `playwright.config.ts` (projects: desktop
Chrome + Pixel 7).
- [ ] Journey: home guest draft → sign up → studio prefilled → Générer → card completes → play in persistent player → share → anonymous context opens `/t/<token>` and plays → rename → delete → library empty state → sign out.
- [ ] Password reset: admin `generateLink({type:'recovery'})` → visit `/auth/confirm?token_hash=…&type=recovery&next=/nouveau-mot-de-passe` → set new password → sign in with it.
- [ ] Screenshots of every page (desktop + mobile) saved under `test-results/screens/`; review each image; fix anything ugly; repeat.
- [ ] Full suite: lint, build, unit, integration (mock server), e2e (both projects). Commit `test(e2e): full journey, password reset, visual review`.
- [ ] Final whole-branch review by one fresh reviewer (most capable model); fix findings; re-verify.
