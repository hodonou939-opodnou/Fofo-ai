import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "@/app/bibliotheque/page";
import PlayerProvider from "@/components/player/player-provider";
import { STALE_JOB_THRESHOLD_SECONDS } from "@/lib/generation/stale-jobs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }),
    rpc: vi.fn(),
  }),
}));

const calls: string[] = [];
let jobRows: unknown[] = [];

function builder(result: () => unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "is", "order", "eq", "limit"]) {
    b[m] = vi.fn((...args: unknown[]) => {
      calls.push(`${m}:${JSON.stringify(args)}`);
      return b;
    });
  }
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: result(), error: null }).then(resolve);
  return b;
}

const rhythmRows = [
  { slug: "tchinkounme", name: "Tchinkounmè", region: null, description_fr: "", alternate_names: [], instruments: [], cultural_review_status: "unverified" },
  { slug: "zinli", name: "Zinli", region: null, description_fr: "", alternate_names: [], instruments: [], cultural_review_status: "unverified" },
];

const rpc = vi.fn(async () => {
  calls.push("rpc");
  return { data: 0, error: null };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    rpc,
    from: (table: string) => (table === "rhythms" ? builder(() => rhythmRows) : builder(() => jobRows)),
  }),
}));

function job(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Création ${id}`,
    prompt: `idée ${id}`,
    status: "completed",
    error_message: null,
    share_token: null,
    created_at: "2026-10-06T10:00:00Z",
    duration_seconds: 30,
    rhythms: { slug: "zinli", name: "Zinli" },
    audio_assets: { duration_seconds: 30 },
    ...overrides,
  };
}

async function renderLibrary(rythme?: string) {
  // page omitted: first page
  render(<PlayerProvider>{await LibraryPage({ searchParams: Promise.resolve({ rythme }) })}</PlayerProvider>);
}

beforeEach(() => {
  calls.length = 0;
  jobRows = [job("j1"), job("j2", { status: "failed", error_message: "La génération a échoué. Réessaie dans quelques instants." })];
  vi.clearAllMocks();
});

describe("LibraryPage", () => {
  it("fails the user's stale creations before listing them", async () => {
    await renderLibrary();
    expect(rpc).toHaveBeenCalledWith("fail_stale_generation_jobs", { p_stale_after_seconds: STALE_JOB_THRESHOLD_SECONDS });
    const firstJobQuery = calls.findIndex((c) => c.startsWith("is:"));
    expect(calls.indexOf("rpc")).toBeLessThan(firstJobQuery);
  });

  it("hides deleted creations and asks for one row more than a page, to know if there are more", async () => {
    await renderLibrary();
    expect(calls).toContain('is:["deleted_at",null]');
    expect(calls).toContain("limit:[51]");
  });

  it("offers the next page when there are more than 50 creations, and shows only 50", async () => {
    jobRows = Array.from({ length: 51 }, (_, i) => job(`p${i}`));
    await renderLibrary();
    expect(within(screen.getByRole("list", { name: "Ma bibliothèque" })).getAllByRole("listitem")).toHaveLength(50);
    expect(screen.getByRole("link", { name: "Afficher plus" })).toHaveAttribute("href", "/bibliotheque?page=2");
  });

  it("loads the first two pages together on page 2, keeping the rhythm filter", async () => {
    jobRows = Array.from({ length: 101 }, (_, i) => job(`q${i}`));
    render(
      <PlayerProvider>
        {await LibraryPage({ searchParams: Promise.resolve({ rythme: "zinli", page: "2" }) })}
      </PlayerProvider>
    );
    expect(calls).toContain("limit:[101]");
    expect(screen.getByRole("link", { name: "Afficher plus" })).toHaveAttribute("href", "/bibliotheque?rythme=zinli&page=3");
  });

  it("offers no next page when everything is shown", async () => {
    await renderLibrary();
    expect(screen.queryByRole("link", { name: "Afficher plus" })).not.toBeInTheDocument();
  });

  it("shows every creation as a cover card, failed ones with their French message", async () => {
    await renderLibrary();
    const grid = screen.getByRole("list", { name: "Ma bibliothèque" });
    expect(within(grid).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Écouter : Création j1" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("La génération a échoué. Réessaie dans quelques instants.");
  });

  it("filters by rhythm from the address and marks the active filter", async () => {
    await renderLibrary("zinli");
    expect(calls).toContain('eq:["rhythms.slug","zinli"]');
    const filters = screen.getByRole("navigation", { name: "Filtrer par rythme" });
    expect(within(filters).getByRole("link", { name: "Zinli" })).toHaveAttribute("aria-current", "page");
    expect(within(filters).getByRole("link", { name: "Tous" })).toHaveAttribute("href", "/bibliotheque");
  });

  it("invites a first creation when the library is empty", async () => {
    jobRows = [];
    await renderLibrary();
    expect(screen.getByRole("link", { name: "Créer ma première musique" })).toHaveAttribute("href", "/studio");
  });

  it("says so when a rhythm filter matches nothing", async () => {
    jobRows = [];
    await renderLibrary("zinli");
    expect(screen.getByText("Aucune création avec ce rythme pour l'instant.")).toBeInTheDocument();
  });
});
