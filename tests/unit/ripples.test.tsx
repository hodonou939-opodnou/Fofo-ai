import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Ripples from "@/components/brand/ripples";

describe("Ripples", () => {
  it("fades the rings across the whole motif, not per ring (or every ring is invisible at its own edge)", () => {
    const { container } = render(<Ripples />);
    const gradient = container.querySelector("radialGradient")!;
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(5);
  });
});
