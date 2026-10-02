import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey);

const createdUserIds: string[] = [];
const createdRhythmSlugs: string[] = [];

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

describe("Row Level Security", () => {
  let userA: Awaited<ReturnType<typeof signUpAndSignIn>>;
  let userB: Awaited<ReturnType<typeof signUpAndSignIn>>;

  beforeAll(async () => {
    userA = await signUpAndSignIn(`user-a-${Date.now()}@example.test`);
    userB = await signUpAndSignIn(`user-b-${Date.now()}@example.test`);
  });

  afterAll(async () => {
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
});
