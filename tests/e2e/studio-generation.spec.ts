import { test, expect } from "@playwright/test";

test("a signed-in user can generate a track end-to-end with the mock provider", async ({
  page,
  request,
}) => {
  // Never generate against a server that would call the real (paid) provider.
  const probe = await request.post("/api/generate");
  expect(
    probe.headers()["x-generation-provider"],
    "Refusing to generate: start the dev server with GENERATION_PROVIDER=mock"
  ).toBe("mock");

  const email = `studio-${Date.now()}@example.test`;
  const password = "correct horse battery staple 1!";

  await page.goto("/inscription");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/studio/);

  await page.getByLabel("Décris ton idée").fill("a joyful celebration");
  await page.getByRole("button", { name: "Générer" }).click();

  const download = page.getByRole("link", { name: /télécharger/i });
  await expect(download).toBeVisible({ timeout: 30_000 });
  await expect(download).toHaveAttribute("href", /\?download=1$/);

  await page.goto("/bibliotheque");
  await expect(page.getByText("a joyful celebration")).toBeVisible();
});
