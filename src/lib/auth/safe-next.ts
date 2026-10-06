const BASE = "http://fofo.invalid";

// Where to send someone after signing in / confirming a link. Only paths on
// this site are accepted; anything that could leave it ("//host", "https:",
// backslash tricks, even percent-encoded) falls back — no open redirect.
export function safeNextPath(raw: string | null | undefined, fallback = "/studio"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
