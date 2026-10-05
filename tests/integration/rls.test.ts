import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey);

const createdUserIds: string[] = [];
const createdRhythmSlugs: string[] = [];
const uploadedPaths: string[] = [];

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
  await client.auth.signInWithPassword({ email, password });
  return client;
}

async function userIdOf(client: Awaited<ReturnType<typeof signUpAndSignIn>>) {
  const { data } = await client.auth.getUser();
  return data.user!.id;
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

describe("Row Level Security", () => {
  let userA: Awaited<ReturnType<typeof signUpAndSignIn>>;
  let userB: Awaited<ReturnType<typeof signUpAndSignIn>>;
  let idA: string;
  let idB: string;
  let rhythmId: string;

  async function insertJobForA(status = "queued") {
    const { data, error } = await admin
      .from("generation_jobs")
      .insert({
        user_id: idA,
        rhythm_id: rhythmId,
        prompt: "rls",
        duration_seconds: 15,
        status,
        idempotency_key: `rls-${idA}-${Math.random()}`,
      })
      .select("id, created_at")
      .single();
    if (error) throw error;
    return data;
  }

  async function jobRow(id: string) {
    const { data } = await admin
      .from("generation_jobs")
      .select("status, created_at, error_message")
      .eq("id", id)
      .single();
    return data!;
  }

  beforeAll(async () => {
    userA = await signUpAndSignIn(`user-a-${Date.now()}@example.test`);
    userB = await signUpAndSignIn(`user-b-${Date.now()}@example.test`);
    idA = await userIdOf(userA);
    idB = await userIdOf(userB);
    const { data: rhythm } = await admin.from("rhythms").select("id").eq("slug", "zinli").single();
    rhythmId = rhythm!.id;
  });

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      await admin.storage.from("generations").remove(uploadedPaths);
    }
    for (const slug of createdRhythmSlugs) {
      await admin.from("rhythms").delete().eq("slug", slug);
    }
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("only exposes published rhythms to anonymous readers", async () => {
    const slug = `draft-${Date.now()}`;
    createdRhythmSlugs.push(slug);
    await admin.from("rhythms").insert({
      slug,
      name: "Draft Rhythm",
      description_fr: "not yet public",
      status: "draft",
    });
    const anon = createClient(url, anonKey);
    const { data } = await anon.from("rhythms").select("slug").eq("status", "draft");
    expect(data).toHaveLength(0);
  });

  it("prevents a user from reading another user's profile", async () => {
    const { data: ownProfile } = await userA.from("profiles").select("id").single();
    expect(ownProfile).not.toBeNull();

    const { data: otherProfile, error } = await userB
      .from("profiles")
      .select("id")
      .eq("id", ownProfile!.id);

    expect(error).toBeNull();
    expect(otherProfile).toHaveLength(0);
  });

  it("prevents a user from changing their own job directly (e.g. backdating created_at)", async () => {
    const job = await insertJobForA();

    await userA
      .from("generation_jobs")
      .update({ created_at: "2000-01-01T00:00:00Z", status: "completed" })
      .eq("id", job.id);

    const after = await jobRow(job.id);
    expect(after.status).toBe("queued");
    expect(new Date(after.created_at).getTime()).toBe(new Date(job.created_at).getTime());
  });

  it("prevents a user from inserting usage records directly", async () => {
    const job = await insertJobForA();

    const { error } = await userA
      .from("usage_records")
      .insert({ user_id: idA, generation_job_id: job.id, estimated_cost: 0 });

    expect(error).not.toBeNull();
  });

  it("prevents a user from inserting audio assets directly", async () => {
    const job = await insertJobForA("completed");

    const { error } = await userA.from("audio_assets").insert({
      generation_job_id: job.id,
      storage_path: `${idA}/${job.id}.wav`,
      format: "wav",
      duration_seconds: 15,
      sample_rate: 44100,
      file_size_bytes: 100,
    });

    expect(error).not.toBeNull();
  });

  it("prevents a user from driving another user's job through the transition functions", async () => {
    const job = await insertJobForA();

    const start = await userB.rpc("start_generation_job", { p_job_id: job.id });
    const fail = await userB.rpc("fail_generation_job", {
      p_job_id: job.id,
      p_error_message: "hijacked",
    });
    const complete = await userB.rpc("complete_generation_job", {
      p_job_id: job.id,
      p_storage_path: `${idB}/${job.id}.wav`,
      p_format: "wav",
      p_duration_seconds: 15,
      p_sample_rate: 44100,
      p_file_size_bytes: 100,
    });

    expect(start.error).not.toBeNull();
    expect(fail.error).not.toBeNull();
    expect(complete.error).not.toBeNull();
    const after = await jobRow(job.id);
    expect(after.status).toBe("queued");
    expect(after.error_message).toBeNull();
  });

  it("only completes a job with audio stored in the caller's own folder", async () => {
    const job = await insertJobForA();
    expect((await userA.rpc("start_generation_job", { p_job_id: job.id })).error).toBeNull();

    const { error } = await userA.rpc("complete_generation_job", {
      p_job_id: job.id,
      p_storage_path: `${idB}/${job.id}.wav`,
      p_format: "wav",
      p_duration_seconds: 15,
      p_sample_rate: 44100,
      p_file_size_bytes: 100,
    });

    expect(error).not.toBeNull();
    expect((await jobRow(job.id)).status).toBe("processing");
  });

  it("prevents a stranger from signing a URL for another user's stored audio", async () => {
    const path = `${idA}/rls-${Date.now()}.wav`;
    const { error: uploadError } = await userA.storage
      .from("generations")
      .upload(path, emptyWav(), { contentType: "audio/wav" });
    expect(uploadError).toBeNull();
    uploadedPaths.push(path);

    const own = await userA.storage.from("generations").createSignedUrl(path, 60);
    expect(own.error).toBeNull();

    const stranger = await userB.storage.from("generations").createSignedUrl(path, 60);
    expect(stranger.error).not.toBeNull();
    expect(stranger.data).toBeNull();
  });

  it("rejects non-audio uploads to the generations bucket", async () => {
    const path = `${idA}/not-audio-${Date.now()}.txt`;
    uploadedPaths.push(path); // removed in afterAll should the upload wrongly succeed

    const { error } = await userA.storage
      .from("generations")
      .upload(path, Buffer.from("hello"), { contentType: "text/plain" });

    expect(error).not.toBeNull();
  });
});
