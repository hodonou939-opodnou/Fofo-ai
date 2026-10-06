import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RhythmCard from "@/components/rhythms/rhythm-card";

const zinli = {
  slug: "zinli",
  name: "Zinli",
  region: "Abomey (Zou)",
  descriptionFr: "Rythme fon d’Abomey (Zou). Créé sous le roi Glèlè (XIXe s.).",
  culturalReviewStatus: "unverified" as const,
};

describe("RhythmCard", () => {
  it("links to the rhythm's own page", () => {
    render(<RhythmCard {...zinli} />);
    expect(screen.getByRole("link", { name: /zinli/i })).toHaveAttribute("href", "/rythmes/zinli");
  });

  it("names the rhythm and where it comes from", () => {
    render(<RhythmCard {...zinli} />);
    expect(screen.getByRole("heading", { name: "Zinli" })).toBeInTheDocument();
    expect(screen.getByText("Abomey (Zou)")).toBeInTheDocument();
  });

  it("discloses when cultural review is still pending", () => {
    render(<RhythmCard {...zinli} />);
    expect(screen.getByText(/validation culturelle en cours/i)).toBeInTheDocument();
  });

  it("drops the notice once the description has been reviewed", () => {
    render(<RhythmCard {...zinli} culturalReviewStatus="reviewed" />);
    expect(screen.queryByText(/validation culturelle en cours/i)).not.toBeInTheDocument();
  });
});
