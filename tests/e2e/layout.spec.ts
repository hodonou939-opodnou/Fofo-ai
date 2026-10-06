import { test, expect } from "@playwright/test";

// Layout checks a unit test can't see (real CSS, real viewport).
test("on a phone the header stays on one line, without the duplicate call to action", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "phone-only check");
  await page.goto("/connexion");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Créer ma musique" })).toBeHidden();
  const signIn = header.getByRole("link", { name: "Se connecter" });
  const box = await signIn.boundingBox();
  expect(box!.height).toBeLessThan(40);
});
