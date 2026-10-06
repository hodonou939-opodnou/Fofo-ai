import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "correct horse battery staple 1!";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

// Never generate against a server that would call the real (paid) provider.
export async function assertMockServer(request: APIRequestContext) {
  const probe = await request.post("/api/generate");
  expect(
    probe.headers()["x-generation-provider"],
    "Refusing to generate: start the dev server with GENERATION_PROVIDER=mock"
  ).toBe("mock");
}

export async function signUp(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

// A finger can only tap what is really on screen: the element must sit inside
// the viewport AND be the topmost element at its own centre. (Playwright's
// click would scroll overflow-hidden boxes, which a finger cannot.)
export async function expectTappable(locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible();
  const reachable = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const inViewport = r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return inViewport && !!hit && (hit === el || el.contains(hit));
  });
  expect(reachable, "element must be fully on screen and on top at its centre").toBe(true);
}
