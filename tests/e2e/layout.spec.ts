import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Layout checks a unit test can't see (real CSS, real viewport).
test("on a phone the header stays on one line, without the duplicate call to action", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "phone-only check");
  await page.goto("/connexion");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Créer ma musique" })).toBeHidden();
  const signIn = header.getByRole("link", { name: "Se connecter" });
  const box = await signIn.boundingBox();
  expect(box!.height).toBeLessThan(40);
});

const PAGES = [
  "/",
  "/rythmes",
  "/rythmes/tchinkounme",
  "/rythmes/zinli",
  "/rythmes/toba",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/confidentialite",
  "/cgu",
  "/une-page-qui-nexiste-pas",
];

test("no page scrolls sideways on a phone", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "phone-only check");
  for (const path of PAGES) {
    await page.goto(path);
    // clientWidth, not innerWidth: mobile Chrome stretches innerWidth to fit an
    // overflowing page, which would hide the very problem being checked.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${path} is wider than the screen by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test("no member page scrolls sideways on a phone", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "phone-only check");
  await page.goto("/inscription");
  await signUp(page, uniqueEmail("layout"));
  await page.waitForURL(/\/studio/);
  for (const path of ["/studio", "/bibliotheque", "/compte"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${path} is wider than the screen by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
