import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreationBox from "@/components/create/creation-box";
import { PROMPT_MAX_LENGTH } from "@/lib/generation/options";
import { loadDraft, saveDraft } from "@/lib/studio/draft";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rhythms = [
  { slug: "tchinkounme", name: "Tchinkounmè" },
  { slug: "zinli", name: "Zinli" },
  { slug: "toba", name: "Toba" },
];

const fetchMock = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  sessionStorage.clear();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function typeIdea(value = "une fête") {
  fireEvent.change(screen.getByLabelText("Décris ton idée"), { target: { value } });
}

function renderSignedIn(onCreated = vi.fn(), initialRhythm?: string) {
  render(<CreationBox rhythms={rhythms} mode="signed-in" onCreated={onCreated} initialRhythm={initialRhythm} />);
  return onCreated;
}

async function submitAndWait(callCount: number) {
  fireEvent.click(screen.getByRole("button", { name: "Générer" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(callCount));
  await waitFor(() => expect(screen.getByRole("button", { name: "Générer" })).toBeEnabled());
}

function sentBody(call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe("CreationBox — signed in", () => {
  it("sends the chosen options with a per-submission UUID and reports the new job", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { jobId: "job-1" }));
    const onCreated = renderSignedIn();
    typeIdea();
    fireEvent.click(screen.getByRole("button", { name: "Zinli" }));

    await submitAndWait(1);

    expect(sentBody(0)).toMatchObject({
      rhythmSlug: "zinli",
      prompt: "une fête",
      mood: "Festif",
      energy: "Modérée",
      durationSeconds: 30,
    });
    expect(sentBody(0).submissionId).toMatch(UUID);
    expect(onCreated).toHaveBeenCalledWith("job-1", expect.objectContaining({ prompt: "une fête", rhythmSlug: "zinli" }));
  });

  it("uses a new submission id for each deliberate submission, even after an error response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "job_creation_failed" }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { jobId: "job-2" }));
    renderSignedIn();
    typeIdea();

    await submitAndWait(1);
    await submitAndWait(2);

    expect(sentBody(1).submissionId).not.toBe(sentBody(0).submissionId);
  });

  it("shows a connection message on a network failure and reuses the submission id on retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { jobId: "job-1" }));
    const onCreated = renderSignedIn();
    typeIdea();

    await submitAndWait(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Connexion perdue — réessaie.");

    await submitAndWait(2);
    expect(sentBody(1).submissionId).toBe(sentBody(0).submissionId);
    expect(onCreated).toHaveBeenCalledWith("job-1", expect.anything());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    [503, "Le service de génération est momentanément indisponible."],
    [429, "Tu as atteint la limite de générations par heure. Réessaie plus tard."],
  ])("explains a %i in plain French", async (status, message) => {
    fetchMock.mockResolvedValue(jsonResponse(status, { error: "x" }));
    const onCreated = renderSignedIn();
    typeIdea();
    await submitAndWait(1);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("asks for an idea instead of sending an empty one", async () => {
    renderSignedIn();
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Décris ton idée en quelques mots.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps the idea at the server's maximum length", () => {
    renderSignedIn();
    expect(screen.getByLabelText("Décris ton idée")).toHaveAttribute("maxLength", String(PROMPT_MAX_LENGTH));
  });

  it("starts on the rhythm passed in from a rhythm page", () => {
    renderSignedIn(vi.fn(), "toba");
    expect(screen.getByRole("button", { name: "Toba" })).toHaveAttribute("aria-pressed", "true");
  });

  it("picks up a guest's draft after sign-up, then forgets it", () => {
    saveDraft({ prompt: "une veillée douce", rhythmSlug: "zinli", mood: "Paisible", energy: "Faible", durationSeconds: 60 });
    renderSignedIn();
    expect(screen.getByLabelText("Décris ton idée")).toHaveValue("une veillée douce");
    expect(screen.getByRole("button", { name: "Zinli" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Durée")).toHaveValue("60");
    expect(loadDraft()).toBeNull();
  });

  it("still works when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => renderSignedIn()).not.toThrow();
    expect(screen.getByLabelText("Décris ton idée")).toHaveValue("");
  });
});

describe("CreationBox — guest", () => {
  function renderGuest() {
    render(<CreationBox rhythms={rhythms} mode="guest" />);
  }

  it("keeps the idea and sends the visitor to sign up, without generating anything", () => {
    renderGuest();
    typeIdea("un mariage joyeux");
    fireEvent.click(screen.getByRole("button", { name: "Toba" }));
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadDraft()).toMatchObject({ prompt: "un mariage joyeux", rhythmSlug: "toba" });
    expect(push).toHaveBeenCalledWith("/inscription?next=/studio");
  });

  it("lets a returning visitor sign in instead and keeps the idea", () => {
    renderGuest();
    typeIdea("un mariage joyeux");
    fireEvent.click(screen.getByRole("button", { name: "J'ai déjà un compte" }));
    expect(loadDraft()).toMatchObject({ prompt: "un mariage joyeux" });
    expect(push).toHaveBeenCalledWith("/connexion?next=/studio");
  });

  it("still sends the visitor on when the browser blocks storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    renderGuest();
    typeIdea();
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(push).toHaveBeenCalledWith("/inscription?next=/studio");
  });
});
