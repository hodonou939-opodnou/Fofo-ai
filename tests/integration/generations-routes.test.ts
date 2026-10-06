import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { baseUrl } from "./generation-helpers";

// Rename / delete / share routes (spec 2026-10-06 §7), against the running app
// and the live database. They never call the provider, so no mock guard needed.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey);

const createdUserIds: string[] = [];
const uploadedPaths: string[] = [];

type User = { id: string; token: string; client: SupabaseClient };

async function user(email: string): Promise<User> {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  const { data: session } = await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, token: session.session!.access_token, client };
}

function call(path: string, token: string | null, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

function emptyWav() {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(88200, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  return header;
}

describe("generation routes — rename, delete, share", () => {
  let owner: User;
  let stranger: User;
  let rhythmId: string;

  async function completedJob() {
    const { data: job, error } = await admin
      .from("generation_jobs")
      .insert({
        user_id: owner.id,
        rhythm_id: rhythmId,
        prompt: "une fête au village",
        duration_seconds: 15,
        status: "completed",
        idempotency_key: `routes-${owner.id}-${Math.random()}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    const path = `${owner.id}/${job.id}.wav`;
    const up = await owner.client.storage.from("generations").upload(path, emptyWav(), { contentType: "audio/wav" });
    if (up.error) throw up.error;
    uploadedPaths.push(path);
    await admin.from("audio_assets").insert({
      generation_job_id: job.id,
      storage_path: path,
      format: "wav",
      duration_seconds: 15,
      sample_rate: 44100,
      file_size_bytes: 44,
    });
    return { id: job.id as string, path };
  }

  beforeAll(async () => {
    const stamp = Date.now();
    owner = await user(`routes-owner-${stamp}@example.test`);
    stranger = await user(`routes-stranger-${stamp}@example.test`);
    const { data } = await admin.from("rhythms").select("id").eq("slug", "toba").single();
    rhythmId = data!.id;
  });

  afterAll(async () => {
    if (uploadedPaths.length) await admin.storage.from("generations").remove(uploadedPaths);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  it("requires a signed-in user", async () => {
    const job = await completedJob();
    expect((await call(`/api/generations/${job.id}`, null, { method: "PATCH", body: "{}" })).status).toBe(401);
    expect((await call(`/api/generations/${job.id}`, null, { method: "DELETE" })).status).toBe(401);
    expect((await call(`/api/generations/${job.id}/share`, null, { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("renames for the owner, validates the title, and hides the job from strangers", async () => {
    const job = await completedJob();
    const ok = await call(`/api/generations/${job.id}`, owner.token, {
      method: "PATCH",
      body: JSON.stringify({ title: "  Danse royale  " }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ title: "Danse royale" });

    const bad = await call(`/api/generations/${job.id}`, owner.token, {
      method: "PATCH",
      body: JSON.stringify({ title: "x".repeat(81) }),
    });
    expect(bad.status).toBe(400);

    const theft = await call(`/api/generations/${job.id}`, stranger.token, {
      method: "PATCH",
      body: JSON.stringify({ title: "volé" }),
    });
    expect(theft.status).toBe(404);
  });

  it("shares and unshares, returning a link on this site", async () => {
    const job = await completedJob();
    const on = await call(`/api/generations/${job.id}/share`, owner.token, {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    expect(on.status).toBe(200);
    const shared = await on.json();
    expect(shared.shareToken).toMatch(/^[0-9a-f]{24}$/);
    expect(shared.url).toBe(`${baseUrl}/t/${shared.shareToken}`);

    expect(
      (
        await call(`/api/generations/${job.id}/share`, stranger.token, {
          method: "POST",
          body: JSON.stringify({ enabled: true }),
        })
      ).status
    ).toBe(404);

    const off = await call(`/api/generations/${job.id}/share`, owner.token, {
      method: "POST",
      body: JSON.stringify({ enabled: false }),
    });
    expect(await off.json()).toEqual({ shareToken: null, url: null });
  });

  it("deletes for the owner: the audio file is gone and the job no longer plays", async () => {
    const job = await completedJob();
    expect((await call(`/api/generations/${job.id}`, stranger.token, { method: "DELETE" })).status).toBe(404);

    const del = await call(`/api/generations/${job.id}`, owner.token, { method: "DELETE" });
    expect(del.status).toBe(204);

    const { data: objects } = await admin.storage.from("generations").list(owner.id, { search: job.id });
    expect(objects).toHaveLength(0);
    expect((await call(`/api/audio/${job.id}`, owner.token)).status).toBe(404);
    expect((await call(`/api/generations/${job.id}`, owner.token, { method: "DELETE" })).status).toBe(409);
  });
});
