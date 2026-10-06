const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"]);

// The video id of a YouTube watch / short / embed link, or null for anything
// else (channel pages, other sites, malformed input).
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;

  let id: string | null = null;
  if (parsed.hostname === "youtu.be") id = parsed.pathname.slice(1);
  else if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
  else if (parsed.pathname.startsWith("/embed/")) id = parsed.pathname.slice("/embed/".length);

  return id && VIDEO_ID.test(id) ? id : null;
}

export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbed(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}
