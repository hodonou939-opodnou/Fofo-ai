import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudioView from "@/components/tracks/studio-view";
import PlayerProvider from "@/components/player/player-provider";
import PlayerBar from "@/components/player/player-bar";
import type { Track } from "@/lib/tracks/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const singleMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }),
    rpc: vi.fn().mockResolvedValue({ data: 0, error: null }),
  }),
}));

const rhythms = [
  { slug: "tchinkounme", name: "Tchinkounmè" },
  { slug: "zinli", name: "Zinli" },
];

const fetchMock = vi.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  fetchMock.mockReset();
  singleMock.mockReset();
  singleMock.mockResolvedValue({
    data: { status: "processing", error_message: null, updated_at: new Date().toISOString(), title: null, share_token: null },
    error: null,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

const done: Track = {
  id: "job-old",
  title: "Veillée douce",
  prompt: "une veillée douce",
  rhythmSlug: "zinli",
  rhythmName: "Zinli",
  durationSeconds: 60,
  status: "completed",
  errorMessage: null,
  shareToken: null,
  createdAt: "2026-10-05T10:00:00Z",
};

function renderStudio(tracks: Track[] = [done]) {
  render(
    <PlayerProvider>
      <StudioView rhythms={rhythms} initialTracks={tracks} />
      <PlayerBar />
    </PlayerProvider>
  );
}

describe("StudioView", () => {
  it("puts a new creation at the top of the grid straight away", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ jobId: "job-new" }), { status: 201 }));
    renderStudio();
    fireEvent.change(screen.getByLabelText("Décris ton idée"), { target: { value: "un marché animé à Dantokpa" } });
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    const grid = await screen.findByRole("list", { name: "Mes créations" });
    await waitFor(() => expect(within(grid).getAllByRole("listitem")).toHaveLength(2));
    const first = within(grid).getAllByRole("listitem")[0];
    expect(first).toHaveTextContent("un marché animé à Dantokpa");
    expect(first).toHaveTextContent(/en file d'attente|création en cours/i);
  });

  it("invites a first creation when there is nothing yet", () => {
    renderStudio([]);
    expect(screen.getByText("Ta première musique t'attend : décris ton idée juste au-dessus.")).toBeInTheDocument();
  });

  it("plays a track in the shared player", () => {
    renderStudio();
    fireEvent.click(screen.getByRole("button", { name: "Écouter : Veillée douce" }));
    expect(screen.getByRole("region", { name: "Lecteur" })).toHaveTextContent("Veillée douce");
  });

  it("refills the creation box with a failed track's idea when retrying", () => {
    renderStudio([{ ...done, id: "job-failed", status: "failed", errorMessage: "Le service est indisponible." }]);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(screen.getByLabelText("Décris ton idée")).toHaveValue("une veillée douce");
    expect(screen.getByRole("button", { name: "Zinli" })).toHaveAttribute("aria-pressed", "true");
  });
});
