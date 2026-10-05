import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "@/app/bibliotheque/page";
import { STALE_JOB_THRESHOLD_SECONDS } from "@/lib/generation/stale-jobs";

const calls: string[] = [];
const rpc = vi.fn<(fn: string, args: unknown) => Promise<{ data: number; error: null }>>(async () => {
  calls.push("rpc");
  return { data: 0, error: null };
});
const limit = vi.fn<(count: number) => Promise<{ data: unknown[]; error: null }>>(async () => ({
  data: [
    { id: "j1", prompt: "une fête", status: "completed", created_at: "", rhythms: { name: "Zinli" } },
    { id: "j2", prompt: "un mariage", status: "queued", created_at: "", rhythms: { name: "Toba" } },
    { id: "j3", prompt: "une veillée", status: "failed", created_at: "", rhythms: null },
  ],
  error: null,
}));
const select = vi.fn(() => {
  calls.push("select");
  return { order: () => ({ limit }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, from: () => ({ select }) }),
}));

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe("LibraryPage", () => {
  it("fails the user's stale jobs before listing them", async () => {
    render(await LibraryPage());

    expect(rpc).toHaveBeenCalledWith("fail_stale_generation_jobs", {
      p_stale_after_seconds: STALE_JOB_THRESHOLD_SECONDS,
    });
    expect(calls).toEqual(["rpc", "select"]);
  });

  it("lists at most 50 jobs", async () => {
    render(await LibraryPage());

    expect(limit).toHaveBeenCalledWith(50);
  });

  it("labels unfinished jobs in French", async () => {
    render(await LibraryPage());

    expect(screen.getByText("Statut : En file d'attente")).toBeInTheDocument();
    expect(screen.getByText("Statut : Échec")).toBeInTheDocument();
    expect(screen.queryByText(/queued|failed/)).not.toBeInTheDocument();
  });

  it("renders a lazy player for completed jobs", async () => {
    const { container } = render(await LibraryPage());

    const players = container.querySelectorAll("audio");
    expect(players).toHaveLength(1);
    expect(players[0]).toHaveAttribute("preload", "none");
    expect(players[0]).toHaveAttribute("src", "/api/audio/j1");
  });
});
