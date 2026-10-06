import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Migration 0006: titles, share links, soft delete and rhythm references.
// These tests talk to the live database directly (no app server needed).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey);
const anon = createClient(url, anonKey);

const createdUserIds: string[] = [];
const uploadedPaths: string[] = [];

async function signedInUser(email: string) {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  await client.auth.signInWithPassword({ email, password });
  return { client, id: data.user.id };
}

// A minimal valid WAV (44-byte header, no samples).
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

describe("migration 0006 — titles, sharing, soft delete, references", () => {
  let owner: { client: SupabaseClient; id: string };
  let stranger: { client: SupabaseClient; id: string };
  let rhythmId: string;

  async function insertJob(status: string, prompt = "une fête de village") {
    const { data, error } = await admin
      .from("generation_jobs")
      .insert({
        user_id: owner.id,
        rhythm_id: rhythmId,
        prompt,
        duration_seconds: 15,
        status,
        idempotency_key: `redesign-${owner.id}-${Math.random()}`,
      })
      .select("id, title")
      .single();
    if (error) throw error;
    return data;
  }

  // A completed job with a real stored object, as the worker leaves it.
  async function insertCompletedJobWithAudio() {
    const job = await insertJob("completed");
    const path = `${owner.id}/${job.id}.wav`;
    const { error: uploadError } = await owner.client.storage
      .from("generations")
      .upload(path, emptyWav(), { contentType: "audio/wav" });
    if (uploadError) throw uploadError;
    uploadedPaths.push(path);
    const { error } = await admin.from("audio_assets").insert({
      generation_job_id: job.id,
      storage_path: path,
      format: "wav",
      duration_seconds: 15,
      sample_rate: 44100,
      file_size_bytes: 44,
    });
    if (error) throw error;
    return { ...job, path };
  }

  beforeAll(async () => {
    const stamp = Date.now();
    owner = await signedInUser(`redesign-owner-${stamp}@example.test`);
    stranger = await signedInUser(`redesign-stranger-${stamp}@example.test`);
    const { data } = await admin.from("rhythms").select("id").eq("slug", "zinli").single();
    rhythmId = data!.id;
  });

  afterAll(async () => {
    if (uploadedPaths.length) await admin.storage.from("generations").remove(uploadedPaths);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  it("gives a new job a default title taken from the start of its prompt", async () => {
    const prompt = "  Une grande fête de village joyeuse au coucher du soleil avec tambours et chants  ";
    const job = await insertJob("queued", prompt);
    expect(job.title).toBe(prompt.trim().slice(0, 60));
  });

  it("lets the owner rename a job, and rejects empty or over-long titles", async () => {
    const job = await insertJob("completed");
    const { error } = await owner.client.rpc("rename_generation_job", {
      p_job_id: job.id,
      p_title: "Fête au village",
    });
    expect(error).toBeNull();
    const { data } = await admin.from("generation_jobs").select("title").eq("id", job.id).single();
    expect(data!.title).toBe("Fête au village");

    const tooLong = await owner.client.rpc("rename_generation_job", { p_job_id: job.id, p_title: "x".repeat(81) });
    expect(tooLong.error?.code).toBe("22023");
    const blank = await owner.client.rpc("rename_generation_job", { p_job_id: job.id, p_title: "   " });
    expect(blank.error?.code).toBe("22023");
  });

  it("refuses rename, share and delete on another user's job", async () => {
    const job = await insertJob("completed");
    const rename = await stranger.client.rpc("rename_generation_job", { p_job_id: job.id, p_title: "volé" });
    const share = await stranger.client.rpc("set_generation_job_sharing", { p_job_id: job.id, p_enabled: true });
    const del = await stranger.client.rpc("delete_generation_job", { p_job_id: job.id });
    expect(rename.error?.code).toBe("P0002");
    expect(share.error?.code).toBe("P0002");
    expect(del.error?.code).toBe("P0002");
  });

  it("only shares completed jobs", async () => {
    const job = await insertJob("processing");
    const { error } = await owner.client.rpc("set_generation_job_sharing", { p_job_id: job.id, p_enabled: true });
    expect(error?.code).toBe("55000");
  });

  it("shares a completed job publicly and stops the moment sharing is disabled", async () => {
    const job = await insertCompletedJobWithAudio();
    const enabled = await owner.client.rpc("set_generation_job_sharing", { p_job_id: job.id, p_enabled: true });
    expect(enabled.error).toBeNull();
    const token = enabled.data as string;
    expect(token).toMatch(/^[0-9a-f]{24}$/);

    const shared = await anon.rpc("get_shared_track", { p_token: token });
    expect(shared.error).toBeNull();
    expect(shared.data).toHaveLength(1);
    expect(shared.data[0]).toMatchObject({ job_id: job.id, rhythm_slug: "zinli", storage_path: job.path });

    const signed = await anon.storage.from("generations").createSignedUrl(job.path, 60);
    expect(signed.error).toBeNull();

    const disabled = await owner.client.rpc("set_generation_job_sharing", { p_job_id: job.id, p_enabled: false });
    expect(disabled.error).toBeNull();
    expect(disabled.data).toBeNull();
    const after = await anon.rpc("get_shared_track", { p_token: token });
    expect(after.data).toHaveLength(0);
    const signedAfter = await anon.storage.from("generations").createSignedUrl(job.path, 60);
    expect(signedAfter.error).not.toBeNull();
  });

  it("soft-deletes a job: hidden, asset row and share link gone, file removable, not deletable twice", async () => {
    const job = await insertCompletedJobWithAudio();
    const { data: token } = await owner.client.rpc("set_generation_job_sharing", { p_job_id: job.id, p_enabled: true });

    const del = await owner.client.rpc("delete_generation_job", { p_job_id: job.id });
    expect(del.error).toBeNull();
    expect(del.data).toBe(job.path);

    const { data: row } = await admin
      .from("generation_jobs")
      .select("deleted_at, share_token")
      .eq("id", job.id)
      .single();
    expect(row!.deleted_at).not.toBeNull();
    expect(row!.share_token).toBeNull();
    const { data: assets } = await admin.from("audio_assets").select("id").eq("generation_job_id", job.id);
    expect(assets).toHaveLength(0);
    const shared = await anon.rpc("get_shared_track", { p_token: token as string });
    expect(shared.data).toHaveLength(0);

    // The object is now orphaned, so 0005's delete policy lets the owner remove it.
    const removed = await owner.client.storage.from("generations").remove([job.path]);
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);

    const again = await owner.client.rpc("delete_generation_job", { p_job_id: job.id });
    expect(again.error?.code).toBe("55000");
  });

  it("does not delete a job that is still being generated", async () => {
    const job = await insertJob("queued");
    const { error } = await owner.client.rpc("delete_generation_job", { p_job_id: job.id });
    expect(error?.code).toBe("55000");
  });

  it("publishes rhythm references and region to anonymous visitors", async () => {
    const { data: refs, error } = await anon
      .from("rhythm_references")
      .select("artist, role, video_url, rhythms!inner(slug)")
      .eq("rhythms.slug", "zinli");
    expect(error).toBeNull();
    expect(refs!.some((r) => r.artist.includes("Alèkpéhanhou"))).toBe(true);

    const { data: rhythm } = await anon.from("rhythms").select("region, instruments").eq("slug", "zinli").single();
    expect(rhythm!.region).toBeTruthy();
    expect(rhythm!.instruments.length).toBeGreaterThan(0);
  });
});
