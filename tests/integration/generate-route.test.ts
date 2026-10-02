import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const admin = createClient(url, serviceKey);
const createdUserIds: string[] = [];
const createdJobIds: string[] = [];

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  return { client, accessToken: signIn.session!.access_token };
}

async function postGenerate(accessToken: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  let accessToken: string;

  beforeAll(async () => {
    const { accessToken: token } = await signUpAndSignIn(`gen-${Date.now()}@example.test`);
    accessToken = token;
  });

  afterAll(async () => {
    for (const id of createdJobIds) {
      await admin.from("generation_jobs").delete().eq("id", id);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("creates a queued job for a valid request", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "zinli",
      prompt: "a calm evening song",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    createdJobIds.push(body.jobId);
  });

  it("rejects an unknown rhythm slug", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "does-not-exist",
      prompt: "x",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(404);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rhythmSlug: "zinli",
        prompt: "x",
        mood: "Paisible",
        energy: "Modérée",
        durationSeconds: 15,
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns the same job id for an identical duplicate submission (idempotency)", async () => {
    const body = {
      rhythmSlug: "toba",
      prompt: "idempotency-check-prompt",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
    };
    const first = await postGenerate(accessToken, body);
    const second = await postGenerate(accessToken, body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstJson = await first.json();
    const secondJson = await second.json();
    createdJobIds.push(firstJson.jobId);
    expect(secondJson.jobId).toBe(firstJson.jobId);
  });
});
