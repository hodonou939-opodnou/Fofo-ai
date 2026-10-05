import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./server";

// Supabase client for a Route Handler, acting as the requesting user.
// Browser requests (Studio UI) carry the session in cookies and use the
// cookie-bound server client. Server-to-server calls and the integration
// tests send `Authorization: Bearer <access token>`: they get a client with
// that token on every request, so RLS sees the right auth.uid() for later
// queries (getUser(token) alone only validates the token). That client keeps
// no session of its own.
export async function createRouteSupabaseClient(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!bearerToken) return createServerSupabaseClient();

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
