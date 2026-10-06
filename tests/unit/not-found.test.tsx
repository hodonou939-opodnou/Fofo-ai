import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

describe("NotFound", () => {
  it("says the page doesn't exist and offers a way back", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "Cette page n'existe pas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Découvrir les rythmes" })).toHaveAttribute("href", "/rythmes");
  });
});
