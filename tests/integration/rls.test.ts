import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey);

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const client = createClient(url, anonKey);
  await client.auth.signInWithPassword({ email, password });
  return client;
}

describe("Row Level Security", () => {
  let userA: ReturnType<typeof createClient>;
  let userB: ReturnType<typeof createClient>;

  beforeAll(async () => {
    userA = await signUpAndSignIn(`user-a-${Date.now()}@example.test`);
    userB = await signUpAndSignIn(`user-b-${Date.now()}@example.test`);
  });

  it("only exposes published rhythms to anonymous readers", async () => {
    await admin.from("rhythms").insert({
      slug: `draft-${Date.now()}`,
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
