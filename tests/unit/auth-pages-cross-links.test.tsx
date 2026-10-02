import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/connexion/page";
import SignUpPage from "@/app/inscription/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Auth pages cross-navigation", () => {
  it("the sign-in page links to sign-up and to password recovery", () => {
    render(<SignInPage />);
    expect(screen.getByRole("link", { name: /créer un compte/i })).toHaveAttribute(
      "href",
      "/inscription"
    );
    expect(screen.getByRole("link", { name: /mot de passe oublié/i })).toHaveAttribute(
      "href",
      "/mot-de-passe-oublie"
    );
  });

  it("the sign-up page links to sign-in", () => {
    render(<SignUpPage />);
    expect(screen.getByRole("link", { name: /se connecter/i })).toHaveAttribute(
      "href",
      "/connexion"
    );
  });
});
