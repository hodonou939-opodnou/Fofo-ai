import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayerProvider, { usePlayer } from "@/components/player/player-provider";
import PlayerBar from "@/components/player/player-bar";
import type { Track } from "@/lib/tracks/types";

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
