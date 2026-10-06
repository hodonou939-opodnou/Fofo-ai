import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SiteHeader from "@/components/layout/site-header";
import MobileTabBar from "@/components/layout/mobile-tab-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/rythmes",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("SiteHeader", () => {
  it("links the Fofo AI logo to the home page", () => {
    render(<SiteHeader user={null} />);
    expect(screen.getByRole("link", { name: /fofo ai/i })).toHaveAttribute("href", "/");
  });

  it("offers sign-in and the main call to action to visitors", () => {
    render(<SiteHeader user={null} />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
    expect(screen.getByRole("link", { name: "Créer ma musique" })).toHaveAttribute("href", "/#creer");
  });

  it("shows the account menu instead of sign-in to members", () => {
    render(<SiteHeader user={{ email: "awa@example.test" }} />);
    expect(screen.queryByRole("link", { name: "Se connecter" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mon compte/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer ma musique" })).toHaveAttribute("href", "/studio");
  });

  it("marks the current section in the navigation", () => {
    render(<SiteHeader user={null} />);
    const nav = screen.getByRole("navigation", { name: "Principale" });
    expect(within(nav).getByRole("link", { name: "Rythmes" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Studio" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileTabBar", () => {
  it("gives members the four sections", () => {
    render(<MobileTabBar signedIn />);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getByRole("link", { name: "Créer" })).toHaveAttribute("href", "/studio");
    expect(within(nav).getByRole("link", { name: "Bibliothèque" })).toHaveAttribute("href", "/bibliotheque");
    expect(within(nav).getByRole("link", { name: "Rythmes" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Compte" })).toHaveAttribute("href", "/compte");
  });

  it("sends visitors to the home creation box and to sign-in", () => {
    render(<MobileTabBar signedIn={false} />);
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getByRole("link", { name: "Créer" })).toHaveAttribute("href", "/#creer");
    expect(within(nav).getByRole("link", { name: "Compte" })).toHaveAttribute("href", "/connexion");
  });
});
