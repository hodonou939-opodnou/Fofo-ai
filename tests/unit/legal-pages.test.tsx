import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/confidentialite/page";
import TermsPage from "@/app/cgu/page";

describe("Legal pages", () => {
  it("renders the privacy policy heading and draft disclosure", () => {
    render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: /confidentialité/i })).toBeInTheDocument();
    expect(screen.getByText(/version préliminaire/i)).toBeInTheDocument();
  });

  it("renders the terms of service heading and draft disclosure", () => {
    render(<TermsPage />);
    expect(screen.getByRole("heading", { name: /conditions générales/i })).toBeInTheDocument();
    expect(screen.getByText(/version préliminaire/i)).toBeInTheDocument();
  });
});
