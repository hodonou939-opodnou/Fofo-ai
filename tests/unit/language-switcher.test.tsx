import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LanguageSwitcher from "@/components/layout/language-switcher";

describe("LanguageSwitcher", () => {
  it("only offers French while the Fon translation file is incomplete", () => {
    render(<LanguageSwitcher activeLocale="fr" />);
    expect(screen.getByRole("button", { name: /français/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fon/i })).not.toBeInTheDocument();
  });
});
