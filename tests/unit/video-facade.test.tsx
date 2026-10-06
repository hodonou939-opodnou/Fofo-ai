import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VideoFacade from "@/components/rhythms/video-facade";
import { youtubeId } from "@/lib/rhythms/youtube";

describe("youtubeId", () => {
  it("reads the id from watch, short and embed links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=9FcyjPzXwX0")).toBe("9FcyjPzXwX0");
    expect(youtubeId("https://youtu.be/9FcyjPzXwX0")).toBe("9FcyjPzXwX0");
    expect(youtubeId("https://www.youtube.com/embed/9FcyjPzXwX0")).toBe("9FcyjPzXwX0");
  });

  it("returns null for a channel page or anything that is not a video", () => {
    expect(youtubeId("https://www.youtube.com/@leroialekpehanhou/videos")).toBeNull();
    expect(youtubeId("https://example.com/watch?v=9FcyjPzXwX0")).toBeNull();
    expect(youtubeId("pas une url")).toBeNull();
    expect(youtubeId(null)).toBeNull();
  });
});

describe("VideoFacade", () => {
  const props = {
    url: "https://www.youtube.com/watch?v=9FcyjPzXwX0",
    title: "GBEZE 01 toba toba",
    artist: "Gbèzé Zeguezougou",
  };

  it("shows a play button and loads nothing from YouTube's player before a click", () => {
    render(<VideoFacade {...props} />);
    expect(screen.getByRole("button", { name: "Lire la vidéo : GBEZE 01 toba toba" })).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("loads the privacy-enhanced player and starts it after a click", () => {
    render(<VideoFacade {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /lire la vidéo/i }));
    const frame = screen.getByTitle("GBEZE 01 toba toba");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/9FcyjPzXwX0?autoplay=1&rel=0");
  });

  it("opens a channel page in a new tab instead of embedding it", () => {
    render(
      <VideoFacade
        url="https://www.youtube.com/@leroialekpehanhou/videos"
        title="Chaîne : Le Roi Alekpehanhou"
        artist="Alèkpéhanhou"
      />
    );
    const link = screen.getByRole("link", { name: /voir la chaîne/i });
    expect(link).toHaveAttribute("href", "https://www.youtube.com/@leroialekpehanhou/videos");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});
