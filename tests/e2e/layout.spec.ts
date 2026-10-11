import { test, expect } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Layout checks a unit test can't see (real CSS, real viewport).
test("on a phone the header stays on one line, without the duplicate call to action", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "phone-only check");
  await page.goto("/connexion");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Créer ma musique" })).toBeHidden();
  const signIn = header.getByRole("link", { name: "Se connecter" });
  // One line of text, whatever the (44 px) box height: count the text's line boxes.
  const lines = await signIn.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
  });
  expect(lines).toBe(1);
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

// Spec §8 / Global Constraint: tap targets of at least 44 px on phones.
test("controls are at least 44 px tall on a phone", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "phone-only check");
  await page.goto("/");
  const targets = [
    page.getByRole("banner").getByRole("link", { name: "Se connecter" }),
    page.getByRole("group", { name: "Rythme" }).getByRole("button").first(),
    page.getByRole("button", { name: "J'ai déjà un compte" }),
    page.getByRole("navigation", { name: "Pied de page" }).getByRole("link").first(),
    page.getByRole("group", { name: "Langue" }).getByRole("button", { name: "Français" }),
  ];
  for (const target of targets) {
    const box = await target.boundingBox();
    expect(box, `${target} has no box`).not.toBeNull();
    expect(box!.height, `${target} is only ${box!.height}px tall`).toBeGreaterThanOrEqual(44);
  }
});
