const BASE = "http://fofo.invalid";

// A value that a browser could resolve to another origin: "//host", "/\host"
// (browsers treat a backslash like a slash), anything with a scheme.
function leavesSite(path: string) {
  return path.startsWith("//") || path.includes("\\");
}

// Where to send someone after signing in / confirming a link. Only paths on
// this site are accepted; anything that could leave it ("//host", "https:",
// backslash tricks, percent-encoding, dot segments such as "/.//host") falls
// back — no open redirect. Both the input and the normalized result are checked:
// URL normalization can turn an innocent-looking input into "//host".
export function safeNextPath(raw: string | null | undefined, fallback = "/studio"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (leavesSite(raw) || leavesSite(decoded)) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    const result = `${url.pathname}${url.search}${url.hash}`;
    return leavesSite(result) || leavesSite(decodeURIComponent(url.pathname)) ? fallback : result;
  } catch {
    return fallback;
  }
}
