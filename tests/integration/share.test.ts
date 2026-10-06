import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { baseUrl } from "./generation-helpers";

// The public share page and audio route (spec 2026-10-06 §5, §7), fetched
// anonymously: no cookie, no token — exactly like a friend opening a WhatsApp link.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey);

const createdUserIds: string[] = [];
const uploadedPaths: string[] = [];

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

describe("public share page and audio", () => {
  let owner: SupabaseClient;
  let ownerId: string;
  let rhythmId: string;

  async function sharedJob(title: string) {
    const { data: job, error } = await admin
      .from("generation_jobs")
      .insert({
        user_id: ownerId,
        rhythm_id: rhythmId,
        prompt: title,
        duration_seconds: 15,
        status: "completed",
        idempotency_key: `share-${ownerId}-${Math.random()}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    const path = `${ownerId}/${job.id}.wav`;
    const up = await owner.storage.from("generations").upload(path, emptyWav(), { contentType: "audio/wav" });
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
    const { data: token, error: shareError } = await owner.rpc("set_generation_job_sharing", {
      p_job_id: job.id,
      p_enabled: true,
    });
    if (shareError) throw shareError;
    return { id: job.id as string, token: token as string };
  }

  beforeAll(async () => {
    const email = `share-owner-${Date.now()}@example.test`;
    const password = "correct horse battery staple 1!";
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    ownerId = data.user!.id;
    createdUserIds.push(ownerId);
    owner = createClient(url, anonKey);
    await owner.auth.signInWithPassword({ email, password });
    const { data: rhythm } = await admin.from("rhythms").select("id").eq("slug", "tchinkounme").single();
    rhythmId = rhythm!.id;
  });

  afterAll(async () => {
    if (uploadedPaths.length) await admin.storage.from("generations").remove(uploadedPaths);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  it("opens the share page for anyone holding the link, without indexing it", async () => {
    const { token } = await sharedJob("Fête au village de Savalou");
    const res = await fetch(`${baseUrl}/t/${token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Fête au village de Savalou");
    expect(html).toContain("Tchinkounmè");
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  });

  it("streams the shared audio through a short-lived signed URL", async () => {
    const { token } = await sharedJob("Veillée");
    const res = await fetch(`${baseUrl}/api/share/${token}/audio`, { redirect: "manual" });
    expect(res.status).toBe(307);
    const audio = await fetch(res.headers.get("location")!);
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toMatch(/^audio\//);
  });

  it("downloads the shared audio as an attachment", async () => {
    const { token } = await sharedJob("Danse");
    const res = await fetch(`${baseUrl}/api/share/${token}/audio?download=1`, { redirect: "manual" });
    const file = await fetch(res.headers.get("location")!);
    expect(file.headers.get("content-disposition")).toContain("attachment");
  });

  it("stops working the moment sharing is turned off", async () => {
    const { id, token } = await sharedJob("Marché");
    await owner.rpc("set_generation_job_sharing", { p_job_id: id, p_enabled: false });
    expect((await fetch(`${baseUrl}/t/${token}`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/share/${token}/audio`, { redirect: "manual" })).status).toBe(404);
  });

  it("stops working once the track is deleted", async () => {
    const { id, token } = await sharedJob("Mariage");
    await owner.rpc("delete_generation_job", { p_job_id: id });
    expect((await fetch(`${baseUrl}/t/${token}`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/share/${token}/audio`, { redirect: "manual" })).status).toBe(404);
  });

  it("answers 404 for a malformed or unknown token", async () => {
    expect((await fetch(`${baseUrl}/t/pas-un-jeton`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/t/${"0".repeat(24)}`)).status).toBe(404);
  });
});
