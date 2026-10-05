import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithRetry } from "./generate-with-retry";
import {
  GENERATION_FAILURE_MESSAGES,
  GENERATION_UNEXPECTED_FAILURE_MESSAGE,
} from "./failure-messages";
import type { MusicGenerationProvider } from "./provider";

const BUCKET = "generations";
const CONTENT_TYPES = { mp3: "audio/mpeg", wav: "audio/wav" } as const;

// The requesting user's client: every write goes through the ownership- and
// transition-checked RPCs of migration 0005 (no service-role key at runtime).
type WorkerClient = Pick<SupabaseClient, "rpc" | "storage">;

export type QueuedGenerationJob = {
  id: string;
  userId: string;
  prompt: string; // the composed provider prompt (buildPrompt)
  durationSeconds: number;
};

// Runs a freshly created job to a terminal state. Never rejects: the job ends
// up completed (atomically with its stored asset) or failed with a French
// message, and diagnostics go to the server logs. If even the terminal write
// is impossible, the stale-job reaper fails the job later.
export async function processGenerationJob({
  supabase,
  provider,
  job,
}: {
  supabase: WorkerClient;
  provider: MusicGenerationProvider;
  job: QueuedGenerationJob;
}): Promise<void> {
  try {
    await runJob(supabase, provider, job);
  } catch (err) {
    console.error(`[generation ${job.id}] unexpected error`, err);
    await markFailed(supabase, job.id, GENERATION_UNEXPECTED_FAILURE_MESSAGE);
  }
}

async function runJob(
  supabase: WorkerClient,
  provider: MusicGenerationProvider,
  job: QueuedGenerationJob
): Promise<void> {
  const { error: startError } = await supabase.rpc("start_generation_job", { p_job_id: job.id });
  if (startError) {
    console.error(`[generation ${job.id}] could not start: ${startError.message}`);
    await markFailed(supabase, job.id, GENERATION_UNEXPECTED_FAILURE_MESSAGE);
    return;
  }

  const result = await generateWithRetry(provider, {
    prompt: job.prompt,
    durationSeconds: job.durationSeconds,
  });
  if (!result.ok) {
    console.error(`[generation ${job.id}] ${provider.name} failed (${result.kind}): ${result.detail}`);
    await markFailed(supabase, job.id, GENERATION_FAILURE_MESSAGES[result.kind]);
    return;
  }

  const storagePath = `${job.userId}/${job.id}.${result.format}`;
  const bucket = supabase.storage.from(BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, result.audio, {
    contentType: CONTENT_TYPES[result.format],
  });
  if (uploadError) {
    console.error(`[generation ${job.id}] upload failed: ${uploadError.message}`);
    await markFailed(supabase, job.id, GENERATION_UNEXPECTED_FAILURE_MESSAGE);
    return;
  }

  const { error: completeError } = await supabase.rpc("complete_generation_job", {
    p_job_id: job.id,
    p_storage_path: storagePath,
    p_format: result.format,
    p_duration_seconds: job.durationSeconds,
    p_sample_rate: result.sampleRate,
    p_file_size_bytes: result.audio.length,
  });
  if (completeError) {
    console.error(`[generation ${job.id}] completion failed: ${completeError.message}`);
    // Remove the object only once the job is known to be failed: if the
    // completion did commit (e.g. only its response was lost), the job is
    // completed and its asset must stay.
    if (await markFailed(supabase, job.id, GENERATION_UNEXPECTED_FAILURE_MESSAGE)) {
      const { error: removeError } = await bucket.remove([storagePath]);
      if (removeError) {
        console.error(`[generation ${job.id}] could not remove ${storagePath}: ${removeError.message}`);
      }
    }
  }
}

// Returns whether the job is now failed. Never throws.
async function markFailed(supabase: WorkerClient, jobId: string, message: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("fail_generation_job", {
      p_job_id: jobId,
      p_error_message: message,
    });
    if (error) {
      console.error(`[generation ${jobId}] could not mark the job failed: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[generation ${jobId}] could not mark the job failed`, err);
    return false;
  }
}
