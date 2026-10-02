import { createServerSupabaseClient } from "@/lib/supabase/server";
import StudioClient from "@/components/studio/studio-client";

export default async function StudioPage() {
  const supabase = await createServerSupabaseClient();
  const { data: rhythms } = await supabase
    .from("rhythms")
    .select("slug, name")
    .eq("status", "published")
    .order("sort_order");

  return (
    <main className="px-6 py-12">
      <h1 className="text-2xl font-semibold mb-6">Studio de création</h1>
      <StudioClient rhythms={rhythms ?? []} />
    </main>
  );
}
