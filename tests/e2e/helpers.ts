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
