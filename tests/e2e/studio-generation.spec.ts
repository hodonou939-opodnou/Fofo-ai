import { test, expect } from "@playwright/test";

test("a signed-in user can generate a track end-to-end with the mock provider", async ({
  page,
}) => {
  const email = `studio-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.getByLabel("Décris ton idée").fill("a joyful celebration");
  await page.getByRole("button", { name: "Générer" }).click();

  await expect(page.getByRole("link", { name: /télécharger/i })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/bibliotheque");
  await expect(page.getByText("a joyful celebration")).toBeVisible();
});
