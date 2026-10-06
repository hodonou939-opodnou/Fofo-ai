import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Cover from "@/components/brand/cover";

describe("Cover", () => {
  // Server (Node) and browser can disagree in the last digits of Math.cos/sin,
  // which breaks hydration; every drawn coordinate must be rounded.
  it.each(["tchinkounme", "zinli", "toba", null])("renders only rounded coordinates for %s", (slug) => {
    const { container } = render(<Cover slug={slug} seed="job-42" />);
    const numbers = Array.from(container.querySelectorAll("circle, rect, path"))
      .flatMap((el) => ["cx", "cy", "r", "x", "y", "width", "height"].map((a) => el.getAttribute(a)))
      .filter((v): v is string => v !== null && /^-?[\d.]+$/.test(v));
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toMatch(/^-?\d+(\.\d{1,2})?$/);
  });
});
