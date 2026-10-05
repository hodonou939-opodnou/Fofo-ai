import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioClient from "@/components/studio/studio-client";

const readJob = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, jobId: string) => ({ single: () => readJob(jobId) }),
      }),
    }),
    rpc: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const created = (jobId: string) =>
  new Response(JSON.stringify({ jobId }), { status: 201, headers: { "content-type": "application/json" } });

describe("StudioClient", () => {
  it("never shows the previous job's player while a new job is pending", async () => {
    fetchMock.mockResolvedValueOnce(created("job-1")).mockResolvedValueOnce(created("job-2"));
    readJob.mockImplementation((jobId: string) =>
      jobId === "job-1"
        ? Promise.resolve({
            data: { status: "completed", error_message: null, updated_at: new Date().toISOString() },
            error: null,
          })
        : new Promise(() => {}) // the new job's first read is still in flight
    );

    render(<StudioClient rhythms={[{ slug: "zinli", name: "Zinli" }]} />);
    fireEvent.change(screen.getByLabelText("Décris ton idée"), { target: { value: "une fête" } });

    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /télécharger/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    await waitFor(() => expect(readJob).toHaveBeenCalledWith("job-2"));

    expect(screen.queryByRole("link", { name: /télécharger/i })).not.toBeInTheDocument();
    expect(screen.getByText("En file d'attente…")).toBeInTheDocument();
  });
});
