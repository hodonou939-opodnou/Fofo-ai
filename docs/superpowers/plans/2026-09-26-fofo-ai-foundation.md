# Fofo AI — Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Fofo AI Next.js application shell — branding, database schema with RLS, authentication, the public rhythm catalog (Tchinkounmè, Zinli, Toba), and bilingual (FR/Fon-ready) UI chrome — as a working, testable slice with no AI generation yet.

**Architecture:** Next.js (App Router, TypeScript) deployed to Vercel; Supabase (Postgres + Auth + Storage) for data and identity, developed locally via the Supabase CLI/Docker so no production credentials are required yet; next-intl for UI translation without URL locale prefixes; Tailwind v4 with brand tokens taken from the supplied logo.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, `@supabase/supabase-js` + `@supabase/ssr`, `next-intl`, Vitest + Testing Library, Playwright, Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-09-26-fofo-ai-phase1-design.md`

## Global Constraints

- Default UI locale is French; Fon is only exposed to users once `messages/fon.json` is marked complete (spec §8).
- No AI-generated or invented Fon translation strings — the Fon message file is filled by a human, never fabricated (spec §8).
- Rhythm cultural descriptions are seeded with `cultural_review_status = 'unverified'` and the UI must say so, never presented as confirmed fact (spec §3, product principle #7).
- Every user-owned table gets Row Level Security; no table is readable/writable cross-user (spec §5, §9).
- Brand colors/typography/logo usage are centralized as design tokens — never hardcoded inline in components (spec §7).
- Service-role keys and any future provider API keys are server-only, never shipped to the client bundle (spec §9).
- No fabricated legal-compliance claims in Privacy/Terms copy — mark it as an early draft pending legal review (spec §9, product principle #7).

## Review Focus

- Selecting Fon before its translation file is complete must not show partial/garbled Fon text — the switcher must hide or disable that option instead.
- A signed-in user must never be able to read another user's `profiles` row through the anon/browser client (RLS gap = account data leak).
- A rhythm with `status = 'draft'` must never appear in the public catalog listing or be reachable at `/rythmes/[slug]` (leaked unpublished content).
- Duplicate sign-up with an already-registered email must surface a clear, non-crashing error, not a silent failure or generic 500.
- Re-running the seed migration must not duplicate the three rhythm rows (idempotent seeding).

---

## File Structure

```
supabase/
  config.toml
  migrations/
    0001_init_schema.sql
    0002_seed_rhythms.sql
src/
  app/
    layout.tsx
    globals.css
    page.tsx                          -- landing
    rythmes/[slug]/page.tsx
    connexion/page.tsx
    inscription/page.tsx
    mot-de-passe-oublie/page.tsx
    confidentialite/page.tsx
    cgu/page.tsx
  components/
    layout/site-header.tsx
    layout/site-footer.tsx
    layout/language-switcher.tsx
    rhythms/rhythm-card.tsx
    auth/sign-in-form.tsx
    auth/sign-up-form.tsx
  lib/
    supabase/client.ts
    supabase/server.ts
    i18n/config.ts
    i18n/get-messages.ts
    design-tokens.ts
  messages/
    fr.json
    fon.json
  types/
    database.ts
tests/
  unit/language-switcher.test.tsx
  unit/rhythm-card.test.tsx
  integration/rls.test.ts
  e2e/auth.spec.ts
public/
  brand/logo-complet.png
  brand/logo-symbol.png
  manifest.webmanifest
```

---

### Task 1: Project scaffold, tooling, and PWA manifest groundwork

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- Create: `vitest.config.ts`, `playwright.config.ts`
- Create: `.env.example`
- Create: `public/manifest.webmanifest`
- Create: `public/brand/logo-complet.png`, `public/brand/logo-symbol.png` (copied from `Media/logo complet.png`, `Media/Logo symbol.png`)
- Modify: `src/app/layout.tsx`, `src/app/page.tsx` (from `create-next-app` defaults)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (Vitest), `npm run test:e2e` (Playwright) as the commands every later task relies on.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Answer "No" to any Git-init prompt (we already control git at the repo root).

- [ ] **Step 2: Add remaining dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr next-intl
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test dotenv
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.tsx", "tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:integration": "vitest run --config vitest.integration.config.ts",
"test:e2e": "playwright test"
```

- [ ] **Step 4: Configure Playwright**

```bash
npx playwright install --with-deps chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 5: Copy brand assets and add the web manifest**

```bash
mkdir -p public/brand
cp "Media/logo complet.png" public/brand/logo-complet.png
cp "Media/Logo symbol.png" public/brand/logo-symbol.png
```

Create `public/manifest.webmanifest`:

```json
{
  "name": "Fofo AI",
  "short_name": "Fofo AI",
  "description": "Crée des musiques originales inspirées des rythmes traditionnels béninois.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F7F3EA",
  "theme_color": "#111111",
  "icons": [
    { "src": "/brand/logo-symbol.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Link it in `src/app/layout.tsx`'s `<head>` metadata (covered fully in Task 2's rewrite of that file).

- [ ] **Step 6: Create `.env.example`**

```bash
# Supabase (local dev: run `supabase start` and copy the printed values)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 7: Verify the scaffold builds and tests run**

Run: `npm run build`
Expected: build succeeds with the default Next.js starter page.

Run: `npm test`
Expected: "No test files found" (not an error — no tests written yet).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Vitest, Playwright, brand assets"
```

---

### Task 2: Design tokens, global layout, and brand shell

**Files:**
- Create: `src/lib/design-tokens.ts`
- Modify: `src/app/globals.css` (Tailwind v4 `@theme` tokens)
- Create: `src/components/layout/site-header.tsx`, `src/components/layout/site-footer.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/site-header.test.tsx`

**Interfaces:**
- Produces: `SiteHeader` (props: `{ activeLocale: "fr" | "fon" }`), `SiteFooter` (no props), both default-exported.
- Consumes: nothing from other tasks yet (this task's header is a static shell; the real `LanguageSwitcher` lands in Task 5 and gets slotted into `SiteHeader` then).

- [ ] **Step 1: Define brand tokens**

Create `src/lib/design-tokens.ts`:

```ts
export const colors = {
  ink: "#111111",
  cream: "#F7F3EA",
  goldStart: "#C9A24B",
  goldEnd: "#8C6A2F",
} as const;

export const fontFamily = {
  sans: "'Noto Sans', system-ui, sans-serif",
} as const;
```

- [ ] **Step 2: Wire tokens into Tailwind v4 theme**

In `src/app/globals.css`, replace the default `@import "tailwindcss";` block with:

```css
@import "tailwindcss";

@theme {
  --color-ink: #111111;
  --color-cream: #F7F3EA;
  --color-gold-start: #C9A24B;
  --color-gold-end: #8C6A2F;
  --font-sans: "Noto Sans", system-ui, sans-serif;
}

body {
  background-color: var(--color-cream);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

- [ ] **Step 3: Load Noto Sans**

In `src/app/layout.tsx`, use `next/font/google`:

```tsx
import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Fofo AI",
  description:
    "Crée des musiques originales inspirées des rythmes traditionnels béninois grâce à l'intelligence artificielle.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Write the failing header test**

Create `tests/unit/site-header.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteHeader from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("renders the Fofo AI wordmark linking to home", () => {
    render(<SiteHeader activeLocale="fr" />);
    const homeLink = screen.getByRole("link", { name: /fofo ai/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders a primary call to action", () => {
    render(<SiteHeader activeLocale="fr" />);
    expect(screen.getByRole("link", { name: /créer ma musique/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- site-header`
Expected: FAIL — `Cannot find module '@/components/layout/site-header'`

- [ ] **Step 6: Implement `SiteHeader` and `SiteFooter`**

Create `src/components/layout/site-header.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";

export default function SiteHeader({ activeLocale }: { activeLocale: "fr" | "fon" }) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Fofo AI">
        <Image src="/brand/logo-symbol.png" alt="" width={32} height={32} />
        <span className="font-semibold text-lg">Fofo AI</span>
      </Link>
      <nav className="flex items-center gap-4" data-active-locale={activeLocale}>
        <Link
          href="/studio"
          className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 text-sm font-medium text-[var(--color-ink)]"
        >
          Créer ma musique
        </Link>
      </nav>
    </header>
  );
}
```

Create `src/components/layout/site-footer.tsx`:

```tsx
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="px-6 py-8 text-sm text-[var(--color-ink)]/70">
      <nav className="flex gap-4">
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/cgu">Conditions générales</Link>
      </nav>
      <p className="mt-2">© {new Date().getFullYear()} Fofo AI.</p>
    </footer>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- site-header`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: brand design tokens, Noto Sans, site header/footer shell"
```

---

### Task 3: Database schema, RLS, and rhythm seed data

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/0001_init_schema.sql`
- Create: `supabase/migrations/0002_seed_rhythms.sql`
- Create: `vitest.integration.config.ts`
- Test: `tests/integration/rls.test.ts`

**Interfaces:**
- Produces: Postgres tables `profiles`, `rhythms`, `generation_jobs`, `audio_assets`, `usage_records` exactly as columned in spec §5; `rhythms.slug` values `'tchinkounme' | 'zinli' | 'toba'`.

- [ ] **Step 1: Initialize the local Supabase project**

```bash
npx supabase init
npx supabase start
```

Copy the printed `API URL`, `anon key`, and `service_role key` into a local `.env.local` (not committed) matching `.env.example`.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/0001_init_schema.sql`:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'fon')),
  created_at timestamptz not null default now()
);

create table rhythms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  alternate_names text[] not null default '{}',
  description_fr text not null,
  description_fon text,
  cultural_review_status text not null default 'unverified'
    check (cultural_review_status in ('unverified', 'reviewed')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  rhythm_id uuid not null references rhythms(id),
  prompt text not null,
  mood text,
  energy text,
  duration_seconds int not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  provider text not null default 'stable-audio',
  idempotency_key text unique not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table audio_assets (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null unique references generation_jobs(id) on delete cascade,
  storage_path text not null,
  format text not null,
  duration_seconds numeric not null,
  sample_rate int not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  generation_job_id uuid not null references generation_jobs(id) on delete cascade,
  estimated_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table rhythms enable row level security;
alter table generation_jobs enable row level security;
alter table audio_assets enable row level security;
alter table usage_records enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on profiles
  for update using (auth.uid() = id);
create policy "profiles: insert own" on profiles
  for insert with check (auth.uid() = id);

create policy "rhythms: public read published" on rhythms
  for select using (status = 'published');

create policy "generation_jobs: owner read" on generation_jobs
  for select using (auth.uid() = user_id);
create policy "generation_jobs: owner insert" on generation_jobs
  for insert with check (auth.uid() = user_id);

create policy "audio_assets: owner read" on audio_assets
  for select using (
    exists (
      select 1 from generation_jobs
      where generation_jobs.id = audio_assets.generation_job_id
        and generation_jobs.user_id = auth.uid()
    )
  );

create policy "usage_records: owner read" on usage_records
  for select using (auth.uid() = user_id);
```

- [ ] **Step 2 continued: Auto-create a profile row on signup**

Append to the same migration:

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 3: Write the idempotent seed migration**

Create `supabase/migrations/0002_seed_rhythms.sql`:

```sql
insert into rhythms (slug, name, alternate_names, description_fr, cultural_review_status, status, sort_order)
values
  (
    'tchinkounme',
    'Tchinkounmè',
    array['Tchinkoumé', 'Tchingounmin', 'Tchinkounmey', 'Gota'],
    'Rythme mahi de Savalou (Collines). Percussion aquatique (tohoun). Origine funéraire, devenu festif. Modernisé en « Tchink System » par Stan Tohon.',
    'unverified',
    'published',
    1
  ),
  (
    'zinli',
    'Zinli',
    array['Avi Zinli', 'Zinli rénové'],
    'Rythme fon d''Abomey (Zou), créé sous le règne du roi Glèlè (XIXe s.). À l''origine funéraire royal. Instrument principal : kpézin (jarre). Modernisé en « Zinli rénové » par Alèkpéhanhou.',
    'unverified',
    'published',
    2
  ),
  (
    'toba',
    'Toba',
    array['Toba-Hanyé'],
    'Rythme populaire, influence yoruba-nago. Présent dans les Collines, le Zou, l''Atlantique, le Littoral. Utilisé pour fêtes, mariages, funérailles, souvent associé au Hanyé.',
    'unverified',
    'published',
    3
  )
on conflict (slug) do nothing;
```

Run: `npx supabase migration up`
Expected: both migrations apply without error.

- [ ] **Step 4: Write the failing RLS integration test**

Create `vitest.integration.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Create `tests/integration/setup.ts`:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

Create `tests/integration/rls.test.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey);

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const client = createClient(url, anonKey);
  await client.auth.signInWithPassword({ email, password });
  return client;
}

describe("Row Level Security", () => {
  let userA: ReturnType<typeof createClient>;
  let userB: ReturnType<typeof createClient>;

  beforeAll(async () => {
    userA = await signUpAndSignIn(`user-a-${Date.now()}@example.test`);
    userB = await signUpAndSignIn(`user-b-${Date.now()}@example.test`);
  });

  it("only exposes published rhythms to anonymous readers", async () => {
    await admin.from("rhythms").insert({
      slug: `draft-${Date.now()}`,
      name: "Draft Rhythm",
      description_fr: "not yet public",
      status: "draft",
    });
    const anon = createClient(url, anonKey);
    const { data } = await anon.from("rhythms").select("slug").eq("status", "draft");
    expect(data).toHaveLength(0);
  });

  it("prevents a user from reading another user's profile", async () => {
    const { data: ownProfile } = await userA.from("profiles").select("id").single();
    expect(ownProfile).not.toBeNull();

    const { data: otherProfile, error } = await userB
      .from("profiles")
      .select("id")
      .eq("id", ownProfile!.id);

    expect(error).toBeNull();
    expect(otherProfile).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:integration`
Expected: FAIL with connection or missing-env-var errors until `.env.local` is populated from Step 1; once populated, it should already pass against a correctly written migration — if `profiles` leaks, the second assertion fails with `otherProfile` non-empty.

- [ ] **Step 6: Fix schema/policies until the test passes**

Re-run `npx supabase migration up` after any SQL edit, then re-run Step 5's command.

Run: `npm run test:integration`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: database schema, RLS policies, and rhythm seed data"
```

---

### Task 4: Supabase auth (sign up, sign in, password reset)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- Create: `src/components/auth/sign-up-form.tsx`, `src/components/auth/sign-in-form.tsx`
- Create: `src/app/inscription/page.tsx`, `src/app/connexion/page.tsx`, `src/app/mot-de-passe-oublie/page.tsx`
- Test: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Produces: `createBrowserSupabaseClient()` from `src/lib/supabase/client.ts`, `createServerSupabaseClient()` from `src/lib/supabase/server.ts` — every later task that touches Supabase from a Server Component/Route Handler uses these two functions.

- [ ] **Step 1: Create Supabase client helpers**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 2: Build the sign-up form**

Create `src/components/auth/sign-up-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Un compte existe déjà avec cet e-mail."
          : "Impossible de créer le compte. Réessaie."
      );
      return;
    }
    router.push("/studio");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Mot de passe
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 font-medium"
      >
        Créer mon compte
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Build the sign-in form**

Create `src/components/auth/sign-in-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou mot de passe incorrect.");
      return;
    }
    router.push("/studio");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label className="flex flex-col gap-1">
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        Mot de passe
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="rounded-full bg-[var(--color-gold-start)] px-4 py-2 font-medium"
      >
        Me connecter
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Create the auth pages**

Create `src/app/inscription/page.tsx`:

```tsx
import SignUpForm from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Crée ton compte Fofo AI</h1>
      <SignUpForm />
    </main>
  );
}
```

Create `src/app/connexion/page.tsx`:

```tsx
import SignInForm from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Connexion</h1>
      <SignInForm />
    </main>
  );
}
```

Create `src/app/mot-de-passe-oublie/page.tsx` (minimal, calls `supabase.auth.resetPasswordForEmail`):

```tsx
"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
  }

  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Mot de passe oublié</h1>
      {sent ? (
        <p>Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
          <label className="flex flex-col gap-1">
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-full bg-[var(--color-gold-start)] px-4 py-2">
            Envoyer le lien
          </button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Write the failing e2e auth test**

Create `tests/e2e/auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("a new user can sign up, land on /studio, sign out, and sign back in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Me connecter" }).click();
  await expect(page).toHaveURL(/\/studio/);
});

test("duplicate sign-up shows a clear error instead of crashing", async ({ page }) => {
  const email = `dup-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
```

Note: `/studio` does not exist yet (it lands in the next plan) — for this test to pass now, add a minimal placeholder at `src/app/studio/page.tsx`:

```tsx
export default function StudioPlaceholder() {
  return <main className="px-6 py-12">Studio — bientôt disponible.</main>;
}
```

- [ ] **Step 6: Run test to verify it fails, then passes**

Run: `npm run test:e2e`
Expected first: FAIL (missing `/studio`, or forms not yet wired) → after Steps 2-5's code and the placeholder page are in place → PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Supabase auth flows (sign up, sign in, password reset)"
```

---

### Task 5: i18n scaffolding (French + Fon-ready) and language switcher

**Files:**
- Create: `src/lib/i18n/config.ts`, `src/lib/i18n/get-messages.ts`
- Create: `src/messages/fr.json`, `src/messages/fon.json`
- Create: `src/components/layout/language-switcher.tsx`
- Modify: `src/components/layout/site-header.tsx` (slot in the switcher)
- Test: `tests/unit/language-switcher.test.tsx`

**Interfaces:**
- Produces: `getMessages(locale)` returning the parsed message object; `isFonComplete()` returning `boolean`, read from `fon.json`'s top-level `"__complete"` marker.
- Consumes: `SiteHeader` from Task 2 (adds a slot for the switcher next to the CTA).

- [ ] **Step 1: Create the message files**

Create `src/messages/fr.json`:

```json
{
  "__complete": true,
  "nav": { "cta": "Créer ma musique" },
  "landing": {
    "hero_title": "Les rythmes du Bénin. Une nouvelle façon de créer.",
    "hero_subtitle": "Crée des musiques originales inspirées des rythmes traditionnels béninois grâce à l'intelligence artificielle.",
    "step_1": "Choisis ton rythme",
    "step_2": "Décris ton idée",
    "step_3": "Écoute et télécharge ta création"
  }
}
```

Create `src/messages/fon.json` (structure present, values intentionally left for a native speaker to fill in — marked incomplete so the switcher stays hidden):

```json
{
  "__complete": false,
  "nav": { "cta": "" },
  "landing": {
    "hero_title": "",
    "hero_subtitle": "",
    "step_1": "",
    "step_2": "",
    "step_3": ""
  }
}
```

- [ ] **Step 2: Implement the message loader**

Create `src/lib/i18n/config.ts`:

```ts
export const locales = ["fr", "fon"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";
```

Create `src/lib/i18n/get-messages.ts`:

```ts
import fr from "@/messages/fr.json";
import fon from "@/messages/fon.json";
import type { Locale } from "./config";

const catalogs = { fr, fon } as const;

export function getMessages(locale: Locale) {
  return catalogs[locale];
}

export function isFonComplete(): boolean {
  return catalogs.fon.__complete === true;
}
```

- [ ] **Step 3: Write the failing switcher test**

Create `tests/unit/language-switcher.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LanguageSwitcher from "@/components/layout/language-switcher";

describe("LanguageSwitcher", () => {
  it("only offers French while the Fon translation file is incomplete", () => {
    render(<LanguageSwitcher activeLocale="fr" />);
    expect(screen.getByRole("button", { name: /français/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fon/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- language-switcher`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the switcher**

Create `src/components/layout/language-switcher.tsx`:

```tsx
"use client";

import { isFonComplete } from "@/lib/i18n/get-messages";
import type { Locale } from "@/lib/i18n/config";

export default function LanguageSwitcher({ activeLocale }: { activeLocale: Locale }) {
  const fonAvailable = isFonComplete();

  return (
    <div className="flex gap-2 text-sm" role="group" aria-label="Langue">
      <button type="button" aria-pressed={activeLocale === "fr"}>
        Français
      </button>
      {fonAvailable && (
        <button type="button" aria-pressed={activeLocale === "fon"}>
          Fon
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes, then slot it into the header**

Run: `npm test -- language-switcher`
Expected: PASS

In `src/components/layout/site-header.tsx`, import `LanguageSwitcher` and render `<LanguageSwitcher activeLocale={activeLocale} />` inside the `<nav>`, before the CTA link.

Run: `npm test -- site-header`
Expected: PASS (existing tests still hold — the CTA link is still present).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: i18n scaffolding with locked Fon rollout until translation is complete"
```

---

### Task 6: Rhythm catalog (landing hero + cards + detail pages)

**Files:**
- Create: `src/components/rhythms/rhythm-card.tsx`
- Modify: `src/app/page.tsx` (landing)
- Create: `src/app/rythmes/[slug]/page.tsx`
- Test: `tests/unit/rhythm-card.test.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient()` from Task 4; `rhythms` table shape from Task 3.
- Produces: `RhythmCard` (props: `{ slug: string; name: string; descriptionFr: string; culturalReviewStatus: "unverified" | "reviewed" }`).

- [ ] **Step 1: Write the failing card test**

Create `tests/unit/rhythm-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RhythmCard from "@/components/rhythms/rhythm-card";

describe("RhythmCard", () => {
  it("links to the rhythm detail page", () => {
    render(
      <RhythmCard
        slug="zinli"
        name="Zinli"
        descriptionFr="Rythme fon d'Abomey."
        culturalReviewStatus="unverified"
      />
    );
    expect(screen.getByRole("link", { name: /zinli/i })).toHaveAttribute(
      "href",
      "/rythmes/zinli"
    );
  });

  it("discloses when cultural review is still pending", () => {
    render(
      <RhythmCard
        slug="zinli"
        name="Zinli"
        descriptionFr="Rythme fon d'Abomey."
        culturalReviewStatus="unverified"
      />
    );
    expect(screen.getByText(/validation culturelle en cours/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rhythm-card`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RhythmCard`**

Create `src/components/rhythms/rhythm-card.tsx`:

```tsx
import Link from "next/link";

type Props = {
  slug: string;
  name: string;
  descriptionFr: string;
  culturalReviewStatus: "unverified" | "reviewed";
};

export default function RhythmCard({ slug, name, descriptionFr, culturalReviewStatus }: Props) {
  return (
    <Link
      href={`/rythmes/${slug}`}
      className="block rounded-xl border border-[var(--color-ink)]/10 p-6 hover:border-[var(--color-gold-start)]"
    >
      <h3 className="text-xl font-semibold">{name}</h3>
      <p className="mt-2 text-sm text-[var(--color-ink)]/80">{descriptionFr}</p>
      {culturalReviewStatus === "unverified" && (
        <p className="mt-3 text-xs italic text-[var(--color-ink)]/60">
          Description en validation culturelle en cours.
        </p>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rhythm-card`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the landing page to real data**

Replace `src/app/page.tsx`:

```tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import RhythmCard from "@/components/rhythms/rhythm-card";

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: rhythms } = await supabase
    .from("rhythms")
    .select("slug, name, description_fr, cultural_review_status")
    .eq("status", "published")
    .order("sort_order");

  return (
    <main className="px-6 py-12">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-bold">Les rythmes du Bénin. Une nouvelle façon de créer.</h1>
        <p className="mt-4 text-lg">
          Crée des musiques originales inspirées des rythmes traditionnels béninois grâce à
          l'intelligence artificielle.
        </p>
        <ol className="mt-6 flex flex-col gap-2 text-sm">
          <li>1. Choisis ton rythme</li>
          <li>2. Décris ton idée</li>
          <li>3. Écoute et télécharge ta création</li>
        </ol>
      </section>
      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        {rhythms?.map((r) => (
          <RhythmCard
            key={r.slug}
            slug={r.slug}
            name={r.name}
            descriptionFr={r.description_fr}
            culturalReviewStatus={r.cultural_review_status as "unverified" | "reviewed"}
          />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Build the rhythm detail page**

Create `src/app/rythmes/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function RhythmDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: rhythm } = await supabase
    .from("rhythms")
    .select("name, description_fr, cultural_review_status, alternate_names")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!rhythm) notFound();

  return (
    <main className="px-6 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold">{rhythm.name}</h1>
      {rhythm.alternate_names.length > 0 && (
        <p className="mt-1 text-sm text-[var(--color-ink)]/60">
          Aussi connu sous : {rhythm.alternate_names.join(", ")}
        </p>
      )}
      <p className="mt-4">{rhythm.description_fr}</p>
      {rhythm.cultural_review_status === "unverified" && (
        <p className="mt-4 text-xs italic text-[var(--color-ink)]/60">
          Ces informations proviennent de recherches publiques et sont en attente de validation
          par un expert culturel.
        </p>
      )}
    </main>
  );
}
```

Note: because `rhythms: public read published` (Task 3) filters at the RLS layer too, the explicit `.eq("status", "published")` here is defense-in-depth, not the only guard — a `draft` rhythm is unreachable even if this line were removed.

- [ ] **Step 7: Verify against the review-focus risk (draft rhythms stay hidden)**

Run: `npm run test:integration` (Task 3's suite already asserts this at the RLS layer)
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rhythm catalog landing page and detail pages backed by Supabase"
```

---

### Task 7: Privacy policy and terms pages

**Files:**
- Create: `src/app/confidentialite/page.tsx`, `src/app/cgu/page.tsx`
- Test: `tests/unit/legal-pages.test.tsx`

**Interfaces:** none (static content pages).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/legal-pages.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/confidentialite/page";
import TermsPage from "@/app/cgu/page";

describe("Legal pages", () => {
  it("renders the privacy policy heading and draft disclosure", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /confidentialité/i })).toBeInTheDocument();
    expect(screen.getByText(/version préliminaire/i)).toBeInTheDocument();
  });

  it("renders the terms of service heading and draft disclosure", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { name: /conditions générales/i })).toBeInTheDocument();
    expect(screen.getByText(/version préliminaire/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- legal-pages`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both pages**

Create `src/app/confidentialite/page.tsx`:

```tsx
export default function PrivacyPage() {
  return (
    <main className="px-6 py-12 max-w-2xl prose">
      <h1>Confidentialité</h1>
      <p className="italic">
        Version préliminaire — ce document sera revu par un professionnel du droit avant le
        lancement public.
      </p>
      <p>
        Fofo AI collecte ton adresse e-mail pour créer ton compte, ainsi que les musiques que tu
        génères et leurs paramètres, pour te permettre d'y accéder dans ta bibliothèque
        personnelle. Ces données ne sont pas partagées avec des tiers en dehors des prestataires
        techniques strictement nécessaires au fonctionnement du service (hébergement, base de
        données, génération audio).
      </p>
    </main>
  );
}
```

Create `src/app/cgu/page.tsx`:

```tsx
export default function TermsPage() {
  return (
    <main className="px-6 py-12 max-w-2xl prose">
      <h1>Conditions générales d'utilisation</h1>
      <p className="italic">
        Version préliminaire — ce document sera revu par un professionnel du droit avant le
        lancement public.
      </p>
      <p>
        En utilisant Fofo AI, tu acceptes que les musiques générées soient des créations
        originales produites par un système d'intelligence artificielle, inspirées de rythmes
        traditionnels béninois, et non des enregistrements de musiciens existants.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- legal-pages`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: draft privacy policy and terms of service pages"
```

---

### Task 8: Full build/lint/test pass and README setup instructions

**Files:**
- Modify: `README.md`
- No source changes expected — this task is a verification + documentation gate.

- [ ] **Step 1: Write the local setup instructions**

Replace `README.md`:

```markdown
# Fofo AI

## Setup local

1. `npm install`
2. `npx supabase start` (nécessite Docker) — copie les valeurs affichées dans `.env.local` selon `.env.example`.
3. `npx supabase migration up`
4. `npm run dev`

## Tests

- `npm test` — tests unitaires (Vitest)
- `npm run test:integration` — tests RLS (nécessite `supabase start` et `.env.local`)
- `npm run test:e2e` — parcours auth (Playwright, nécessite `npm run dev` ou le démarre automatiquement)
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: succeeds.

Run: `npm test`
Expected: all unit tests pass.

Run: `npm run test:integration`
Expected: all RLS tests pass (requires `supabase start`).

Run: `npm run test:e2e`
Expected: both auth e2e tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add local setup and testing instructions to README"
```

---

## Self-Review

**1. Spec coverage:** §1 positioning → Task 6 landing copy. §3 catalog/seed → Task 3 + Task 6. §4 architecture/pipeline → out of scope for this plan by design (Plan 2). §5 data model → Task 3 (all five Phase-1 tables + RLS). §6 pages → Tasks 4, 6, 7 cover every Phase-1 route except `/studio` (placeholder only, real studio is Plan 2) and `/bibliotheque` (Plan 2, depends on generation data existing). §7 design system → Task 2. §8 Fon i18n → Task 5. §9 security → Task 3 (RLS) + Task 4 (server-only env vars, no service key in client code). §10 testing → unit, integration, and e2e tests present across tasks. §11 open items → not blocked; local Supabase avoids needing production credentials.

**2. Placeholder scan:** no TBD/TODO; every step has literal code. The `/studio` route created in Task 4 is explicitly labeled a placeholder in its own text ("bientôt disponible"), not a stand-in for missing plan content — it exists solely so Task 4's e2e test has a real redirect target, and Plan 2 replaces it.

**3. Type consistency:** `createBrowserSupabaseClient`/`createServerSupabaseClient` (Task 4) are the only two Supabase entry points used by Task 6; `RhythmCard`'s prop names match the query aliases used in Task 6 Step 5 exactly (`slug`, `name`, `descriptionFr`, `culturalReviewStatus` mapped from `description_fr`/`cultural_review_status`). `Locale` type (Task 5) is reused as `SiteHeader`'s `activeLocale` prop type (Task 2 — update that prop's type from the literal union to `import type { Locale } from "@/lib/i18n/config"` when Task 5 lands).

**4. Review Focus coverage:** Fon-hidden-until-complete → Task 5 test. Cross-user profile read → Task 3 RLS test. Draft rhythm exposure → Task 3 RLS test (draft insert + anon read) and Task 6 Step 7. Duplicate sign-up error → Task 4 e2e test. Idempotent seed → Task 3's `on conflict (slug) do nothing`.
