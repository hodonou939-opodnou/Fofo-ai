import { test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Visual review material (spec 2026-10-06 §2.4): every page, desktop and
// phone, saved to test-results/screens/ and read before calling the work done.
const PUBLIC_PAGES: [string, string][] = [
  ["accueil", "/"],
  ["rythmes", "/rythmes"],
  ["rythme-zinli", "/rythmes/zinli"],
  ["connexion", "/connexion"],
  ["inscription", "/inscription"],
  ["mot-de-passe-oublie", "/mot-de-passe-oublie"],
  ["confidentialite", "/confidentialite"],
  ["introuvable", "/cette-page-nexiste-pas"],
];

test("public pages", async ({ page }, info) => {
  for (const [name, path] of PUBLIC_PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png`, fullPage: true });
  }
});

test("member pages", async ({ page }, info) => {
  await page.goto("/inscription");
  await signUp(page, uniqueEmail("screens"));
  await page.waitForURL(/\/studio/);
  for (const [name, path] of [
    ["studio", "/studio"],
    ["bibliotheque", "/bibliotheque"],
    ["compte", "/compte"],
  ] as const) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png`, fullPage: true });
  }
});
