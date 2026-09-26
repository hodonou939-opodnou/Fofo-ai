import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SiteHeader from "@/components/layout/site-header";

describe("SiteHeader", () => {
  it("renders the Fofo AI wordmark linking to home", () => {
    render(<SiteHeader activeLocale="fr" />);
    const homeLink = screen.getByRole("link", { name: /fofo ai/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders a primary call to action", () => {
    render(<SiteHeader activeLocale="fr" />);
    expect(screen.getByRole("link", { name: /créer ma musique/i })).toBeInTheDocument();
  });
});
