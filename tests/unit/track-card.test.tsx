import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrackCard from "@/components/tracks/track-card";
import { GENERATION_FAILURE_MESSAGES } from "@/lib/generation/failure-messages";
import { STALE_JOB_THRESHOLD_SECONDS } from "@/lib/generation/stale-jobs";
import type { Track } from "@/lib/tracks/types";

const singleMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }),
    rpc: rpcMock,
  }),
}));

const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - (STALE_JOB_THRESHOLD_SECONDS + 60) * 1000).toISOString();
const row = (status: string, extra: Record<string, unknown> = {}) => ({
  data: { status, error_message: null, updated_at: fresh(), title: "Fête au village", share_token: null, ...extra },
  error: null,
});
const readError = { data: null, error: { message: "Failed to fetch" } };

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "job-1",
    title: "Fête au village",
    prompt: "une fête au village",
    rhythmSlug: "tchinkounme",
    rhythmName: "Tchinkounmè",
    durationSeconds: 30,
    status: "completed",
    errorMessage: null,
    shareToken: null,
    createdAt: "2026-10-06T10:00:00Z",
    ...overrides,
  };
}

function renderCard(t: Track) {
  const props = {
    onPlay: vi.fn<(track: Track) => void>(),
    onChange: vi.fn<(track: Track) => void>(),
    onRemoved: vi.fn<(id: string) => void>(),
    onRetry: vi.fn<(track: Track) => void>(),
  };
  render(<TrackCard track={t} {...props} />);
  return props;
}

beforeEach(() => {
  singleMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 0, error: null });
});
afterEach(() => vi.useRealTimers());

describe("TrackCard — finished tracks", () => {
  it("plays a finished track", () => {
    const { onPlay } = renderCard(track());
    fireEvent.click(screen.getByRole("button", { name: "Écouter : Fête au village" }));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }));
    expect(singleMock).not.toHaveBeenCalled();
  });

  it("names the rhythm and the length", () => {
    renderCard(track());
    expect(screen.getByText("Tchinkounmè")).toBeInTheDocument();
    expect(screen.getByText("0:30")).toBeInTheDocument();
  });

  it("keeps a very long title on one line and still exposes it in full", () => {
    const long = "Mi Nou Mi Ni Mon Midé Gbô — une très longue veillée à Abomey sous la lune avec tous les tambours";
    renderCard(track({ title: long }));
    const title = screen.getByText(long);
    expect(title.className).toContain("truncate");
    expect(title).toHaveAttribute("title", long);
  });

  it("shows the French failure message and offers to try again", () => {
    const failed = track({ status: "failed", errorMessage: GENERATION_FAILURE_MESSAGES.unavailable });
    const { onRetry } = renderCard(failed);
    expect(screen.getByRole("alert")).toHaveTextContent(GENERATION_FAILURE_MESSAGES.unavailable);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledWith(failed);
    expect(screen.queryByRole("button", { name: /écouter/i })).not.toBeInTheDocument();
  });
});

describe("TrackCard — live status of a track being created", () => {
  it("shows the creation in progress and cannot be played yet", async () => {
    singleMock.mockResolvedValue(row("processing"));
    renderCard(track({ status: "queued" }));
    expect(screen.getByText("En file d'attente…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /écouter/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Création en cours…")).toBeInTheDocument());
  });

  it("polls every 3 seconds and becomes playable when done", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValueOnce(row("processing")).mockResolvedValueOnce(row("completed", { title: "Fête au village" }));
    const { onChange } = renderCard(track({ status: "queued" }));
    await advance(0);
    expect(screen.getByText("Création en cours…")).toBeInTheDocument();
    await advance(3_000);
    expect(screen.getByRole("button", { name: "Écouter : Fête au village" })).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: "job-1", status: "completed" }));
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("treats a cancelled creation as finished and stops polling", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(row("cancelled"));
    renderCard(track({ status: "queued" }));
    await advance(0);
    await advance(30_000);
    expect(screen.getByText("Création annulée.")).toBeInTheDocument();
    expect(singleMock).toHaveBeenCalledTimes(1);
  });

  it("keeps polling with backoff through transient read errors", async () => {
    vi.useFakeTimers();
    singleMock
      .mockResolvedValueOnce(readError)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(row("completed"));
    renderCard(track({ status: "queued" }));
    await advance(0);
    expect(screen.getByText("En file d'attente…")).toBeInTheDocument();
    await advance(60_000);
    expect(singleMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: /écouter/i })).toBeInTheDocument();
  });

  it("stops and points to the library after repeated read errors", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(readError);
    renderCard(track({ status: "queued" }));
    await advance(10 * 60_000);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de suivre la création — retrouve-la dans ta bibliothèque."
    );
    const calls = singleMock.mock.calls.length;
    await advance(10 * 60_000);
    expect(singleMock).toHaveBeenCalledTimes(calls);
  });

  it("fails a stale creation through the reaper, then shows the failed state", async () => {
    const timeoutMessage = "La génération a pris trop de temps et n'a pas pu aboutir. Réessaie.";
    singleMock
      .mockResolvedValueOnce(row("processing", { updated_at: stale() }))
      .mockResolvedValueOnce(row("failed", { error_message: timeoutMessage }));
    renderCard(track({ status: "queued" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(timeoutMessage));
    expect(rpcMock).toHaveBeenCalledWith("fail_stale_generation_jobs", {
      p_stale_after_seconds: STALE_JOB_THRESHOLD_SECONDS,
    });
  });

  it("does not spin when the reaper leaves the creation running", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(row("processing", { updated_at: stale() }));
    renderCard(track({ status: "queued" }));
    await advance(0);
    expect(singleMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    // one read plus one re-read per interval — the normal pace, not a spin
    await advance(3_000);
    expect(singleMock).toHaveBeenCalledTimes(4);
  });

  it("stops polling once removed from the page", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(row("processing"));
    const { unmount } = render(
      <TrackCard track={track({ status: "queued" })} onPlay={vi.fn()} onChange={vi.fn()} onRemoved={vi.fn()} />
    );
    await advance(0);
    unmount();
    await advance(30_000);
    expect(singleMock).toHaveBeenCalledTimes(1);
  });
});
