import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TrackMenu from "@/components/tracks/track-menu";
import type { Track } from "@/lib/tracks/types";

const fetchMock = vi.fn();
const originalFetch = global.fetch;
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  fetchMock.mockReset();
  writeText.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
  Object.assign(navigator, { clipboard: { writeText } });
});
afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: "job-1",
    title: "Fête au village",
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

function renderMenu(t: Track) {
  const onChange = vi.fn();
  const onRemoved = vi.fn();
  render(<TrackMenu track={t} onChange={onChange} onRemoved={onRemoved} />);
  fireEvent.click(screen.getByRole("button", { name: "Options : Fête au village" }));
  return { onChange, onRemoved };
}

describe("TrackMenu", () => {
  it("offers download as an attachment for a finished track", () => {
    renderMenu(track());
    expect(screen.getByRole("link", { name: "Télécharger" })).toHaveAttribute("href", "/api/audio/job-1?download=1");
  });

  it("shares in one tap: creates the link, shows it, copies it and offers WhatsApp", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { shareToken: "abc123def456abc123def456", url: "http://localhost:3000/t/abc123def456abc123def456" })
    );
    const { onChange } = renderMenu(track());
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));

    const link = await screen.findByLabelText("Lien de partage");
    expect(link).toHaveValue("http://localhost:3000/t/abc123def456abc123def456");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generations/job-1/share",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ enabled: true }) })
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ shareToken: "abc123def456abc123def456" }));

    fireEvent.click(screen.getByRole("button", { name: "Copier le lien" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:3000/t/abc123def456abc123def456");
    expect(screen.getByRole("link", { name: /whatsapp/i }).getAttribute("href")).toContain(
      encodeURIComponent("http://localhost:3000/t/abc123def456abc123def456")
    );
  });

  it("stops sharing on request", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { shareToken: "abc123def456abc123def456", url: "http://x/t/abc" }))
      .mockResolvedValueOnce(jsonResponse(200, { shareToken: null, url: null }));
    const { onChange } = renderMenu(track({ shareToken: "abc123def456abc123def456" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.click(await screen.findByRole("button", { name: "Arrêter le partage" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shareToken: null })));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/generations/job-1/share",
      expect.objectContaining({ body: JSON.stringify({ enabled: false }) })
    );
  });

  it("renames a track", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { title: "Danse royale" }));
    const { onChange } = renderMenu(track());
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Danse royale" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: "Danse royale" })));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/generations/job-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Danse royale" }) })
    );
  });

  it("explains a rejected title", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid_title" }));
    renderMenu(track());
    fireEvent.click(screen.getByRole("button", { name: "Renommer" }));
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Le titre doit faire entre 1 et 80 caractères.");
  });

  it("deletes a track only after confirmation", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { onRemoved } = renderMenu(track());
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Supprimer ce morceau ?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("job-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/generations/job-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("offers neither sharing nor download for a failed creation, but allows deleting it", () => {
    renderMenu(track({ status: "failed", errorMessage: "x" }));
    expect(screen.queryByRole("button", { name: "Partager" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Télécharger" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Supprimer" })).toBeInTheDocument();
  });
});
