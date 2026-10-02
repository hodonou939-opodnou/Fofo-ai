import { test, expect } from "@playwright/test";

test("an unauthenticated visitor to /studio is redirected to /connexion", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/connexion/);
});

test("a signed-in user can reach /studio", async ({ page }) => {
  const email = `guard-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.goto("/studio");
  await expect(page).toHaveURL(/\/studio/);
});
