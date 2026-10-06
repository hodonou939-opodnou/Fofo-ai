import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReferenceList from "@/components/rhythms/reference-list";
import type { RhythmReference } from "@/lib/rhythms/queries";

const references: RhythmReference[] = [
  {
    id: "r1",
    artist: "Gbèzé Zeguezougou",
    role: "Roi du Toba et du Tchinkounmè (Collines)",
    style: "Traditionnel",
    knownWorks: "GBEZE 01 toba toba (>600k vues)",
    videoUrl: "https://www.youtube.com/watch?v=9FcyjPzXwX0",
  },
  {
    id: "r2",
    // Stored decomposed (NFD): must still display as the composed spelling.
    artist: "Alèdo Aïfa / Zosse".normalize("NFD"),
    role: "Artistes et groupes historiques du Toba",
    style: null,
    knownWorks: null,
    videoUrl: null,
  },
];

describe("ReferenceList", () => {
  it("lists each master with their role and style", () => {
    render(<ReferenceList references={references} />);
    const items = within(screen.getByRole("list", { name: "Les maîtres du rythme" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Gbèzé Zeguezougou");
    expect(items[0]).toHaveTextContent("Roi du Toba et du Tchinkounmè (Collines)");
    expect(items[0]).toHaveTextContent("Traditionnel");
  });

  it("shows Fon and French diacritics in their composed form", () => {
    render(<ReferenceList references={references} />);
    expect(screen.getByText("Alèdo Aïfa / Zosse".normalize("NFC"))).toBeInTheDocument();
  });

  it("names the known works of a master when the source gives them", () => {
    render(<ReferenceList references={references} />);
    expect(screen.getByText("GBEZE 01 toba toba (>600k vues)")).toBeInTheDocument();
  });
});
