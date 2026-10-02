import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JobStatus from "@/components/studio/job-status";

const singleMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  }),
}));

describe("JobStatus", () => {
  it("shows the error message when the job fails", async () => {
    singleMock.mockResolvedValue({
      data: { status: "failed", error_message: "Stable Audio error: bad request" },
    });

    render(<JobStatus jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Stable Audio error: bad request/i)).toBeInTheDocument();
    });
  });

  it("shows the player when the job completes", async () => {
    singleMock.mockResolvedValue({ data: { status: "completed", error_message: null } });

    render(<JobStatus jobId="job-2" />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /télécharger/i })).toHaveAttribute(
        "href",
        "/api/audio/job-2"
      );
    });
  });
});
