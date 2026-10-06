import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email_change", "email"];

// Landing point of e-mail links (password reset, confirmations). Accepts the
// PKCE `code` Supabase's default links carry, or the `token_hash` + `type`
// pair of the SSR e-mail template; opens the session, then continues to
// `next` (internal paths only). Expired or reused links go back to sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));
  const invalid = NextResponse.redirect(new URL("/connexion?erreur=lien", url.origin));

  const supabase = await createServerSupabaseClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? invalid : NextResponse.redirect(new URL(next, url.origin));
  }
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return error ? invalid : NextResponse.redirect(new URL(next, url.origin));
  }
  return invalid;
}
