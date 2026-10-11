import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayerProvider, { usePlayer } from "@/components/player/player-provider";
import PlayerBar from "@/components/player/player-bar";
import type { Track } from "@/lib/tracks/types";

// The provider listens for sign-out to clear the player; capture its listener.
let authListener: ((event: string) => void) | null = null;
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

function track(id: string, overrides: Partial<Track> = {}): Track {
  return {
    id,
    title: `Morceau ${id}`,
    rhythmSlug: "zinli",
    rhythmName: "Zinli",
    durationSeconds: 30,
    status: "completed",
    errorMessage: null,
    shareToken: null,
    createdAt: "2026-10-06T10:00:00Z",
    ...overrides,
  };
}

const a = track("a");
const b = track("b");
const c = track("c");
const queue = [a, b, c];

function Controls() {
  const player = usePlayer();
  return (
    <div>
      <p data-testid="current">{player.current?.id ?? "none"}</p>
      <p data-testid="playing">{String(player.isPlaying)}</p>
      <p data-testid="error">{player.error ?? ""}</p>
      <button onClick={() => player.play(a, queue)}>play-a</button>
      <button onClick={() => player.play(c, queue)}>play-c</button>
      <button onClick={() => player.play(track("q", { status: "processing" }), queue)}>play-unfinished</button>
      <button onClick={player.toggle}>toggle</button>
      <button onClick={player.next}>next</button>
      <button onClick={player.previous}>previous</button>
      <button onClick={() => player.forget("a")}>forget-a</button>
    </div>
  );
}

function setup() {
  render(
    <PlayerProvider>
      <Controls />
      <PlayerBar />
    </PlayerProvider>
  );
  return { audio: document.querySelector("audio")! };
}

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("PlayerProvider", () => {
  it("plays a track through the secured audio route", async () => {
    const { audio } = setup();
    await click("play-a");
    expect(screen.getByTestId("current")).toHaveTextContent("a");
    expect(audio.getAttribute("src")).toBe("/api/audio/a");
    expect(playSpy).toHaveBeenCalled();
    expect(screen.getByTestId("playing")).toHaveTextContent("true");
  });

  it("pauses and resumes with toggle", async () => {
    setup();
    await click("play-a");
    await click("toggle");
    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.getByTestId("playing")).toHaveTextContent("false");
    await click("toggle");
    expect(screen.getByTestId("playing")).toHaveTextContent("true");
  });

  it("walks the queue with next and previous and stops at both ends", async () => {
    setup();
    await click("play-a");
    await click("previous");
    expect(screen.getByTestId("current")).toHaveTextContent("a");
    await click("next");
    expect(screen.getByTestId("current")).toHaveTextContent("b");
    await click("next");
    await click("next");
    expect(screen.getByTestId("current")).toHaveTextContent("c");
  });

  it("moves to the next track when one ends", async () => {
    const { audio } = setup();
    await click("play-a");
    await act(async () => {
      fireEvent(audio, new Event("ended"));
    });
    expect(screen.getByTestId("current")).toHaveTextContent("b");
  });

  it("ignores tracks that are not finished yet", async () => {
    setup();
    await click("play-unfinished");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("shows a clear message and stays usable when the audio cannot be loaded", async () => {
    const { audio } = setup();
    await click("play-a");
    await act(async () => {
      fireEvent(audio, new Event("error"));
    });
    expect(screen.getByTestId("playing")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent(/impossible de lire/i);
    await click("play-c");
    expect(screen.getByTestId("current")).toHaveTextContent("c");
    expect(screen.getByTestId("error")).toHaveTextContent("");
  });
});

describe("PlayerBar", () => {
  it("stays hidden until something has been played", () => {
    setup();
    expect(screen.queryByRole("region", { name: "Lecteur" })).not.toBeInTheDocument();
  });

  it("shows the current track with a pause control while playing", async () => {
    setup();
    await click("play-a");
    const bar = screen.getByRole("region", { name: "Lecteur" });
    expect(bar).toHaveTextContent("Morceau a");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });
});

describe("PlayerBar — controls the spec asks for on every screen", () => {
  function PlayShared() {
    const player = usePlayer();
    const shared = track("s", { src: "/api/share/abc123def456abc123def456/audio", shareToken: "abc123def456abc123def456" });
    return <button onClick={() => player.play(shared)}>play-shared</button>;
  }

  it("offers a seek bar and the track's duration", async () => {
    setup();
    await click("play-a");
    expect(screen.getByRole("slider", { name: "Position dans le morceau" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Lecteur" })).toHaveTextContent("0:30");
  });

  it("downloads the member's own track as an attachment", async () => {
    setup();
    await click("play-a");
    expect(screen.getByRole("link", { name: "Télécharger" })).toHaveAttribute("href", "/api/audio/a?download=1");
  });

  it("shares the member's own track from the player", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ shareToken: "abc123def456abc123def456", url: "http://x/t/abc123def456abc123def456" }), { status: 200 })
    );
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      setup();
      await click("play-a");
      await click("Partager");
      expect(screen.getByRole("dialog", { name: "Partager" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith("/api/generations/a/share", expect.objectContaining({ method: "POST" }));
    } finally {
      global.fetch = original;
    }
  });

  it("downloads a shared track through its share link and offers no owner-only sharing", async () => {
    render(
      <PlayerProvider>
        <PlayShared />
        <PlayerBar />
      </PlayerProvider>
    );
    await click("play-shared");
    expect(screen.getByRole("link", { name: "Télécharger" })).toHaveAttribute(
      "href",
      "/api/share/abc123def456abc123def456/audio?download=1"
    );
    expect(screen.queryByRole("button", { name: "Partager" })).not.toBeInTheDocument();
  });
});

describe("PlayerProvider — privacy on shared phones", () => {
  it("clears the player as soon as the member signs out, wherever that happens", async () => {
    const { audio } = setup();
    await click("play-a");
    await act(async () => {
      authListener?.("SIGNED_OUT");
    });
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(screen.queryByRole("region", { name: "Lecteur" })).not.toBeInTheDocument();
    expect(pauseSpy).toHaveBeenCalled();
    expect(audio.getAttribute("src")).toBeNull();
  });

  it("forgets a track deleted while it plays", async () => {
    setup();
    await click("play-a");
    await click("forget-a");
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(screen.queryByRole("region", { name: "Lecteur" })).not.toBeInTheDocument();
  });

  it("keeps playing when a different track is deleted", async () => {
    setup();
    await click("play-c");
    await click("forget-a");
    expect(screen.getByTestId("current")).toHaveTextContent("c");
  });
});
