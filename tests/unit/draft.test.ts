import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/lib/studio/draft";

const draft: Draft = {
  prompt: "une veillée douce à Abomey",
  rhythmSlug: "zinli",
  mood: "Paisible",
  energy: "Faible",
  durationSeconds: 30,
};

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("guest draft", () => {
  it("survives a round trip and is gone once cleared", () => {
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("ignores a corrupted or foreign value", () => {
    sessionStorage.setItem("fofo:draft", "{not json");
    expect(loadDraft()).toBeNull();
    sessionStorage.setItem("fofo:draft", JSON.stringify({ prompt: 42 }));
    expect(loadDraft()).toBeNull();
  });

  it("never throws when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => saveDraft(draft)).not.toThrow();
    expect(loadDraft()).toBeNull();
    expect(() => clearDraft()).not.toThrow();
  });
});
