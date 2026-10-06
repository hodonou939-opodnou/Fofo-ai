import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-next";

describe("safeNextPath", () => {
  it("keeps an internal path, with its query and hash", () => {
    expect(safeNextPath("/studio")).toBe("/studio");
    expect(safeNextPath("/bibliotheque?rythme=zinli")).toBe("/bibliotheque?rythme=zinli");
    expect(safeNextPath("/nouveau-mot-de-passe")).toBe("/nouveau-mot-de-passe");
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["absolute", "https://evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["encoded backslash", "/%5Cevil.example"],
    ["javascript url", "javascript:alert(1)"],
    ["dot segment", "/.//evil.example"],
    ["parent segment", "/x/..//evil.example"],
    ["encoded dot segment", "/%2e//evil.example"],
    ["relative", "studio"],
    ["empty", ""],
  ])("refuses a %s target and falls back to the Studio", (_label, target) => {
    expect(safeNextPath(target)).toBe("/studio");
  });

  it("falls back when there is no target at all", () => {
    expect(safeNextPath(null)).toBe("/studio");
    expect(safeNextPath(undefined)).toBe("/studio");
  });

  it("uses the given fallback", () => {
    expect(safeNextPath("//evil.example", "/")).toBe("/");
  });
});
