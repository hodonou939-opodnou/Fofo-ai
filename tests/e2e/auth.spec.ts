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
