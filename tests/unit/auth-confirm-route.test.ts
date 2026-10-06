import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/confirm/route";

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp } }),
}));

beforeEach(() => vi.clearAllMocks());

function get(query: string) {
  return GET(new Request(`http://localhost:3000/auth/confirm${query}`));
}

describe("GET /auth/confirm", () => {
  it("opens the session from a PKCE code and goes to the requested page", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await get("?code=abc&next=/nouveau-mot-de-passe");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/nouveau-mot-de-passe");
  });

  it("verifies a recovery token hash", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const res = await get("?token_hash=hash123&type=recovery&next=/nouveau-mot-de-passe");
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "hash123", type: "recovery" });
    expect(res.headers.get("location")).toBe("http://localhost:3000/nouveau-mot-de-passe");
  });

  it("sends an expired or reused link back to sign-in with an explanation", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const res = await get("?token_hash=old&type=recovery&next=/nouveau-mot-de-passe");
    expect(res.headers.get("location")).toBe("http://localhost:3000/connexion?erreur=lien");
  });

  it("treats a link with neither code nor token as invalid", async () => {
    const res = await get("?next=/studio");
    expect(res.headers.get("location")).toBe("http://localhost:3000/connexion?erreur=lien");
  });

  it("never redirects outside the site", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await get("?code=abc&next=//evil.example");
    expect(res.headers.get("location")).toBe("http://localhost:3000/studio");
  });

  it("never redirects outside the site through dot segments", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await get("?code=abc&next=/.//evil.example");
    expect(res.headers.get("location")).toBe("http://localhost:3000/studio");
  });

  it("ignores an unknown token type", async () => {
    const res = await get("?token_hash=hash&type=nonsense");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3000/connexion?erreur=lien");
  });
});
