import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { PASSWORD, uniqueEmail } from "./helpers";

config({ path: ".env.local" });

// Password reset end to end. No real e-mail is sent: the recovery link is
// generated through the admin API (service-role, tests only) and opened the
// way the recommended e-mail template would (token_hash on /auth/confirm).
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

test("a member who forgot their password sets a new one from the recovery link", async ({ page }) => {
  const email = uniqueEmail("reset");
  const { data: created } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  try {
    const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    expect(error).toBeNull();
    const tokenHash = link.properties!.hashed_token;

    await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/nouveau-mot-de-passe`);
    await expect(page).toHaveURL(/\/nouveau-mot-de-passe$/);

    const newPassword = "un nouveau mot de passe 2!";
    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirme le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page).toHaveURL(/\/studio/);

    await page.context().clearCookies();
    await page.goto("/connexion");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Me connecter" }).click();
    await expect(page).toHaveURL(/\/studio/);
  } finally {
    if (created.user) await admin.auth.admin.deleteUser(created.user.id);
  }
});

test("a used or expired recovery link is explained, not silently ignored", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=deja-utilise&type=recovery&next=/nouveau-mot-de-passe");
  await expect(page).toHaveURL(/\/connexion\?erreur=lien/);
  // Next.js also renders an (empty) role=alert route announcer: match ours by its text.
  await expect(page.getByRole("alert").filter({ hasText: "Ce lien" })).toHaveText("Ce lien n'est plus valide. Demande un nouveau lien.");
});

test("the forgot-password form always tells the visitor what happened", async ({ page }) => {
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("E-mail").fill(uniqueEmail("forgot"));
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  // Either the e-mail was accepted, or Supabase refused (e.g. built-in mailer
  // limits) — in both cases the page says so instead of staying silent.
  await expect(page.getByRole("status").or(page.getByRole("alert"))).toBeVisible();
});
