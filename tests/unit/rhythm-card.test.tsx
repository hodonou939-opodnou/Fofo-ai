import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RhythmCard from "@/components/rhythms/rhythm-card";

describe("RhythmCard", () => {
  it("links to the rhythm detail page", () => {
    render(
      <RhythmCard
        slug="zinli"
        name="Zinli"
        descriptionFr="Rythme fon d'Abomey."
        culturalReviewStatus="unverified"
      />
    );
    expect(screen.getByRole("link", { name: /zinli/i })).toHaveAttribute(
      "href",
      "/rythmes/zinli"
    );
  });

  it("discloses when cultural review is still pending", () => {
    render(
      <RhythmCard
        slug="zinli"
        name="Zinli"
        descriptionFr="Rythme fon d'Abomey."
        culturalReviewStatus="unverified"
      />
    );
    expect(screen.getByText(/validation culturelle en cours/i)).toBeInTheDocument();
  });
});
