import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobStatus from "@/components/studio/job-status";
import { GENERATION_FAILURE_MESSAGES } from "@/lib/generation/failure-messages";
import { STALE_JOB_THRESHOLD_SECONDS } from "@/lib/generation/stale-jobs";

const singleMock = vi.fn();
const rpcMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
    rpc: rpcMock,
  }),
}));

const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - (STALE_JOB_THRESHOLD_SECONDS + 60) * 1000).toISOString();
const job = (status: string, extra: Record<string, unknown> = {}) => ({
  data: { status, error_message: null, updated_at: fresh(), ...extra },
  error: null,
});
const readError = { data: null, error: { message: "Failed to fetch" } };

// Lets pending promises and due timers run under fake timers.
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  singleMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: 0, error: null });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("JobStatus", () => {
  it("shows the stored French message when the job fails", async () => {
    singleMock.mockResolvedValue(
      job("failed", { error_message: GENERATION_FAILURE_MESSAGES.unavailable })
    );

    render(<JobStatus jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(GENERATION_FAILURE_MESSAGES.unavailable);
    });
  });

  it("shows the player and a download link when the job completes", async () => {
    singleMock.mockResolvedValue(job("completed"));

    render(<JobStatus jobId="job-2" />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /télécharger/i })).toHaveAttribute(
        "href",
        "/api/audio/job-2?download=1"
      );
    });
  });

  it("treats a cancelled job as finished", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(job("cancelled"));

    render(<JobStatus jobId="job-3" />);
    await advance(0);
    await advance(30_000);

    expect(screen.getByText("La génération a été annulée.")).toBeInTheDocument();
    expect(singleMock).toHaveBeenCalledTimes(1);
  });

  it("polls a running job every 3 seconds", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValueOnce(job("processing")).mockResolvedValueOnce(job("completed"));

    render(<JobStatus jobId="job-4" />);
    await advance(0);
    expect(screen.getByText("Génération en cours…")).toBeInTheDocument();

    await advance(3_000);
    expect(screen.getByRole("link", { name: /télécharger/i })).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("keeps polling with backoff through transient read errors", async () => {
    vi.useFakeTimers();
    singleMock
      .mockResolvedValueOnce(readError)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(job("completed"));

    render(<JobStatus jobId="job-5" />);
    await advance(0);
    expect(screen.getByText("En file d'attente…")).toBeInTheDocument();

    await advance(60_000);
    expect(singleMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("link", { name: /télécharger/i })).toBeInTheDocument();
  });

  it("stops and points to the library after repeated read errors", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(readError);

    render(<JobStatus jobId="job-6" />);
    await advance(10 * 60_000);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Impossible de suivre la génération — retrouve-la dans ta bibliothèque."
    );
    const calls = singleMock.mock.calls.length;
    await advance(10 * 60_000);
    expect(singleMock).toHaveBeenCalledTimes(calls);
  });

  it("fails a stale job through the reaper RPC, then shows the failed state", async () => {
    const timeoutMessage = "La génération a pris trop de temps et n'a pas pu aboutir. Réessaie.";
    singleMock
      .mockResolvedValueOnce(job("processing", { updated_at: stale() }))
      .mockResolvedValueOnce(job("failed", { error_message: timeoutMessage }));

    render(<JobStatus jobId="job-7" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(timeoutMessage);
    });
    expect(rpcMock).toHaveBeenCalledWith("fail_stale_generation_jobs", {
      p_stale_after_seconds: STALE_JOB_THRESHOLD_SECONDS,
    });
  });

  it("does not spin when the reaper leaves the job running", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(job("processing", { updated_at: stale() }));

    render(<JobStatus jobId="job-8" />);
    await advance(0);
    // one read, the reaper call, one immediate re-read — then back to the poll interval
    expect(singleMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenCalledTimes(1);

    await advance(3_000);
    expect(singleMock).toHaveBeenCalledTimes(4);
  });

  it("stops polling once unmounted", async () => {
    vi.useFakeTimers();
    singleMock.mockResolvedValue(job("processing"));

    const { unmount } = render(<JobStatus jobId="job-9" />);
    await advance(0);
    unmount();
    await advance(30_000);

    expect(singleMock).toHaveBeenCalledTimes(1);
  });
});
