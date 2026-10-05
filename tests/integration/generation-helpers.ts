import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Generation tests must never reach the real provider: they would spend real
// credits and prove nothing about it. Outside production, /api/generate names
// its active provider in the x-generation-provider header, even on a 401.
export async function assertMockProvider() {
  let provider: string | null;
  try {
    const res = await fetch(`${baseUrl}/api/generate`, { method: "POST" });
    provider = res.headers.get("x-generation-provider");
  } catch {
    throw new Error(
      `No server reachable at ${baseUrl}: start the dev server with GENERATION_PROVIDER=mock.`
    );
  }
  if (provider !== "mock") {
    throw new Error(
      `The server at ${baseUrl} reports generation provider "${provider ?? "unknown"}", not the mock. ` +
        "Refusing to run generation tests: start the dev server with GENERATION_PROVIDER=mock."
    );
  }
}

export async function postGenerate(accessToken: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ submissionId: randomUUID(), ...body }),
  });
}

export type JobRow = { status: string; error_message: string | null };

// Polls until the job is completed or failed (or ~10 s elapse).
export async function waitForTerminalJob(admin: SupabaseClient, jobId: string) {
  let job: JobRow | null = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    const { data } = await admin
      .from("generation_jobs")
      .select("status, error_message")
      .eq("id", jobId)
      .single();
    job = data;
    if (job && (job.status === "completed" || job.status === "failed")) break;
  }
  return job;
}
