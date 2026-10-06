import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/connexion/page";
import SignUpPage from "@/app/inscription/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const params = (q: Record<string, string> = {}) => ({ searchParams: Promise.resolve(q) });

describe("Auth pages cross-navigation", () => {
  it("the sign-in page links to sign-up and to password recovery", async () => {
    render(await SignInPage(params()));
    expect(screen.getByRole("link", { name: /créer un compte/i })).toHaveAttribute("href", "/inscription");
    expect(screen.getByRole("link", { name: /mot de passe oublié/i })).toHaveAttribute("href", "/mot-de-passe-oublie");
  });

  it("the sign-up page links to sign-in", async () => {
    render(await SignUpPage(params()));
    expect(screen.getByRole("link", { name: /se connecter/i })).toHaveAttribute("href", "/connexion");
  });

  it("keeps where the visitor was going when they switch between sign-in and sign-up", async () => {
    render(await SignInPage(params({ next: "/studio" })));
    expect(screen.getByRole("link", { name: /créer un compte/i })).toHaveAttribute("href", "/inscription?next=%2Fstudio");
  });

  it("explains an expired or already-used e-mail link", async () => {
    render(await SignInPage(params({ erreur: "lien" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Ce lien n'est plus valide. Demande un nouveau lien.");
  });
});
