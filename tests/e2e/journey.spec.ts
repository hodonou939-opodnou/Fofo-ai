import { test, expect } from "@playwright/test";
import { assertMockServer, expectTappable, signUp, uniqueEmail } from "./helpers";

// The whole product, as a first-time visitor lives it (spec 2026-10-06 §2):
// home → idea kept through sign-up → create → play → share → a friend opens
// the link without an account → rename → delete → sign out.
test("a visitor creates, plays, shares, renames and deletes a track", async ({ page, request, browser }) => {
  await assertMockServer(request);
  const idea = `Une fête de village au coucher du soleil ${Date.now()}`;
  const title = idea.slice(0, 60);

  // 1. Guest: the idea typed on the home page survives sign-up.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fais vivre les rythmes du Bénin" })).toBeVisible();
  await page.getByLabel("Décris ton idée").fill(idea);
  await page.getByRole("button", { name: "Toba", exact: true }).click();
  await page.getByRole("button", { name: "Générer" }).click();
  await expect(page).toHaveURL(/\/inscription\?next=/);

  await signUp(page, uniqueEmail("journey"));
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.getByLabel("Décris ton idée")).toHaveValue(idea);
  await expect(page.getByRole("button", { name: "Toba", exact: true })).toHaveAttribute("aria-pressed", "true");

  // 2. Create: the card appears at once, then becomes playable.
  await page.getByRole("button", { name: "Générer" }).click();
  const grid = page.getByRole("list", { name: "Mes créations" });
  await expect(grid.getByText(title)).toBeVisible();
  const play = page.getByRole("button", { name: `Écouter : ${title}` });
  await expect(play).toBeVisible({ timeout: 45_000 });

  // 3. Play in the persistent player.
  await play.click();
  await expect(page.getByRole("region", { name: "Lecteur" })).toContainText(title);

  // 4. Share, and open the link as someone without an account.
  await page.getByRole("button", { name: `Options : ${title}` }).click();
  for (const item of ["Partager", "Renommer", "Supprimer"]) {
    await expectTappable(page.getByRole("button", { name: item, exact: true }));
  }
  await expectTappable(page.getByRole("link", { name: "Télécharger" }));
  await page.getByRole("button", { name: "Partager" }).click();
  const linkField = page.getByLabel("Lien de partage");
  await expect(linkField).toHaveValue(/\/t\/[0-9a-f]{24}$/);
  const shareUrl = await linkField.inputValue();
  await page.getByRole("button", { name: "Fermer" }).click();

  const friend = await browser.newContext();
  const friendPage = await friend.newPage();
  await friendPage.goto(shareUrl);
  await expect(friendPage.getByRole("heading", { name: title })).toBeVisible();
  await expect(friendPage.getByRole("link", { name: "Crée la tienne" })).toBeVisible();
  await friendPage.getByRole("button", { name: `Écouter : ${title}` }).click();
  await expect(friendPage.getByRole("region", { name: "Lecteur" })).toContainText(title);

  // 5. Rename.
  await page.getByRole("button", { name: `Options : ${title}` }).click();
  await page.getByRole("button", { name: "Renommer" }).click();
  await page.getByLabel("Titre").fill("Danse de test");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(grid.getByText("Danse de test")).toBeVisible();

  // 6. Delete: the card disappears, the share link dies, the library is empty.
  await page.getByRole("button", { name: "Options : Danse de test" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(grid).toHaveCount(0);
  expect((await friendPage.goto(shareUrl))?.status()).toBe(404);
  await friend.close();

  await page.goto("/bibliotheque");
  await expect(page.getByRole("link", { name: "Créer ma première musique" })).toBeVisible();

  // 7. Sign out.
  await page.getByRole("button", { name: "Mon compte" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
});

test("a rhythm page tells its story and starts a creation with that rhythm", async ({ page }) => {
  await page.goto("/rythmes/zinli");
  await expect(page.getByRole("heading", { name: "Zinli", level: 1 })).toBeVisible();
  await expect(page.getByText("Abomey (Zou)", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Les maîtres du rythme" })).toContainText("Alèkpéhanhou");
  await expect(page.getByRole("button", { name: /lire la vidéo/i }).first()).toBeVisible();
  await page.getByRole("link", { name: "Créer avec ce rythme" }).click();
  await expect(page.getByRole("button", { name: "Zinli", exact: true })).toHaveAttribute("aria-pressed", "true");
});
