import { test, expect } from "@playwright/test";
import { assertMockServer, signUp, uniqueEmail } from "./helpers";

// Visual review material (spec 2026-10-06 §2.4): every page on every device,
// saved to test-results/screens/ and read before calling the work done —
// including member pages with a real (mock) track, the open track menu, the
// player, the share page and its link-preview image.
const PUBLIC_PAGES: [string, string][] = [
  ["accueil", "/"],
  ["rythmes", "/rythmes"],
  ["rythme-tchinkounme", "/rythmes/tchinkounme"],
  ["rythme-zinli", "/rythmes/zinli"],
  ["rythme-toba", "/rythmes/toba"],
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

test("member pages with a real track, menu, player and share page", async ({ page, request }, info) => {
  await assertMockServer(request);
  const shot = (name: string, fullPage = true) =>
    page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png`, fullPage });

  await page.goto("/inscription");
  await signUp(page, uniqueEmail("screens"));
  await page.waitForURL(/\/studio/);
  await shot("studio-vide");

  // A title with Fon letters and tone marks, to check every surface renders them.
  const idea = "Mi Nou Mi Ni Mon Midé Gbô — ɖɛɔ, une veillée à Abomey";
  await page.getByLabel("Décris ton idée").fill(idea);
  await page.getByRole("button", { name: "Générer" }).click();
  const title = idea.slice(0, 60);
  await expect(page.getByRole("button", { name: `Écouter : ${title}` })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: `Écouter : ${title}` }).click();
  await expect(page.getByRole("region", { name: "Lecteur" })).toBeVisible();
  await shot("studio-avec-morceau", false);

  await page.getByRole("button", { name: `Options : ${title}` }).click();
  await shot("menu-morceau", false);
  const menu = page.getByRole("group", { name: "Actions du morceau" });
  await menu.getByRole("button", { name: "Partager" }).click();
  const shareUrl = await page.getByLabel("Lien de partage").inputValue();
  await shot("partage-dialogue", false);
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.goto("/bibliotheque");
  await page.waitForLoadState("networkidle");
  await shot("bibliotheque");
  await page.goto("/compte");
  await shot("compte");

  await page.goto(shareUrl);
  await page.waitForLoadState("networkidle");
  await shot("page-partagee");
  if (info.project.name === "desktop") {
    await page.goto(`${new URL(shareUrl).pathname}/opengraph-image`);
    await shot("apercu-lien", false);
  }
});
