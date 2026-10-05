import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GenerationForm from "@/components/studio/generation-form";
import { PROMPT_MAX_LENGTH } from "@/lib/generation/options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rhythms = [{ slug: "zinli", name: "Zinli" }];

const fetchMock = vi.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderForm(onJobCreated = vi.fn()) {
  render(<GenerationForm rhythms={rhythms} onJobCreated={onJobCreated} />);
  fireEvent.change(screen.getByLabelText("Décris ton idée"), { target: { value: "une fête" } });
  return onJobCreated;
}

async function submitAndWait(callCount: number) {
  fireEvent.click(screen.getByRole("button", { name: "Générer" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(callCount));
  await waitFor(() => expect(screen.getByRole("button", { name: "Générer" })).toBeEnabled());
}

function sentBody(call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe("GenerationForm", () => {
  it("sends the chosen options with a per-submission UUID and reports the new job", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { jobId: "job-1" }));
    const onJobCreated = renderForm();

    await submitAndWait(1);

    expect(sentBody(0)).toMatchObject({
      rhythmSlug: "zinli",
      prompt: "une fête",
      mood: "Festif",
      energy: "Faible",
      durationSeconds: 15,
    });
    expect(sentBody(0).submissionId).toMatch(UUID);
    expect(onJobCreated).toHaveBeenCalledWith("job-1");
  });

  it("uses a new submission id for each deliberate submission", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(201, { jobId: "job-1" }));
    renderForm();

    await submitAndWait(1);
    await submitAndWait(2);

    expect(sentBody(1).submissionId).not.toBe(sentBody(0).submissionId);
  });

  it("uses a new submission id after any HTTP response, even an error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "job_creation_failed" }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { jobId: "job-2" }));
    renderForm();

    await submitAndWait(1);
    await submitAndWait(2);

    expect(sentBody(1).submissionId).not.toBe(sentBody(0).submissionId);
  });

  it("shows a connection message on a network failure and reuses the submission id on retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { jobId: "job-1" }));
    const onJobCreated = renderForm();

    await submitAndWait(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Connexion perdue — réessaie.");

    await submitAndWait(2);
    expect(sentBody(1).submissionId).toBe(sentBody(0).submissionId);
    expect(onJobCreated).toHaveBeenCalledWith("job-1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains that the service is unavailable on a 503", async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: "service_unavailable" }));
    const onJobCreated = renderForm();

    await submitAndWait(1);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le service de génération est momentanément indisponible."
    );
    expect(onJobCreated).not.toHaveBeenCalled();
  });

  it("explains the hourly limit on a 429", async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { error: "rate_limited" }));
    renderForm();

    await submitAndWait(1);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tu as atteint la limite de générations par heure. Réessaie plus tard."
    );
  });

  it("caps the idea at the server's maximum length", () => {
    render(<GenerationForm rhythms={rhythms} onJobCreated={vi.fn()} />);
    expect(screen.getByLabelText("Décris ton idée")).toHaveAttribute(
      "maxLength",
      String(PROMPT_MAX_LENGTH)
    );
  });
});
