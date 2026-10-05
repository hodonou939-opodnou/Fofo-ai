import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processGenerationJob } from "@/lib/generation/process-job";
import {
  GENERATION_FAILURE_MESSAGES,
  GENERATION_UNEXPECTED_FAILURE_MESSAGE,
} from "@/lib/generation/failure-messages";
import type { GenerationResult, MusicGenerationProvider } from "@/lib/generation/provider";

const job = { id: "job-1", userId: "user-1", prompt: "final prompt", durationSeconds: 30 };
const audio = Buffer.from([1, 2, 3]);
const success: GenerationResult = { ok: true, audio, format: "wav", sampleRate: 44100 };

type DbError = { message: string };

type DbResult<T> = Promise<{ data: T; error: DbError | null }>;
type Rpc = (fn: string, args?: Record<string, unknown>) => DbResult<null>;
type Upload = (path: string, body: Buffer, opts: { contentType: string }) => DbResult<{ path: string } | null>;
type Remove = (paths: string[]) => DbResult<never[]>;

function fakeSupabase(
  options: {
    rpcErrors?: Record<string, DbError>;
    uploadError?: DbError;
    uploadThrows?: Error;
    failRpcThrows?: Error;
  } = {}
) {
  const rpc = vi.fn<Rpc>(async (fn) => {
    if (fn === "fail_generation_job" && options.failRpcThrows) throw options.failRpcThrows;
    return { data: null, error: options.rpcErrors?.[fn] ?? null };
  });
  const upload = vi.fn<Upload>(async () => {
    if (options.uploadThrows) throw options.uploadThrows;
    return { data: options.uploadError ? null : { path: "p" }, error: options.uploadError ?? null };
  });
  const remove = vi.fn<Remove>(async () => ({ data: [], error: null }));
  const from = vi.fn<(bucket: string) => { upload: typeof upload; remove: typeof remove }>(() => ({
    upload,
    remove,
  }));
  return { supabase: { rpc, storage: { from } } as never, rpc, upload, remove, from };
}

function fakeProvider(generate: MusicGenerationProvider["generate"]) {
  const spy = vi.fn(generate);
  return { provider: { name: "fake", generate: spy } satisfies MusicGenerationProvider, generate: spy };
}

function rpcNames(rpc: ReturnType<typeof fakeSupabase>["rpc"]) {
  return rpc.mock.calls.map(([fn]) => fn);
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("processGenerationJob", () => {
  it("starts the job, uploads the audio to the user's folder, then completes it atomically", async () => {
    const db = fakeSupabase();
    const { provider, generate } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(generate).toHaveBeenCalledWith({ prompt: "final prompt", durationSeconds: 30 });
    expect(db.from).toHaveBeenCalledWith("generations");
    expect(db.upload).toHaveBeenCalledWith("user-1/job-1.wav", audio, { contentType: "audio/wav" });
    expect(rpcNames(db.rpc)).toEqual(["start_generation_job", "complete_generation_job"]);
    expect(db.rpc).toHaveBeenNthCalledWith(1, "start_generation_job", { p_job_id: "job-1" });
    expect(db.rpc).toHaveBeenNthCalledWith(2, "complete_generation_job", {
      p_job_id: "job-1",
      p_storage_path: "user-1/job-1.wav",
      p_format: "wav",
      p_duration_seconds: 30,
      p_sample_rate: 44100,
      p_file_size_bytes: 3,
    });
    expect(db.remove).not.toHaveBeenCalled();
  });

  it.each(["timeout", "unavailable", "refused", "invalid"] as const)(
    "fails the job with the French message for a %s provider failure and logs the detail",
    async (kind) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.useFakeTimers();
      try {
        const db = fakeSupabase();
        const { provider } = fakeProvider(async () => ({ ok: false, kind, detail: "raw provider text" }));

        const done = processGenerationJob({ supabase: db.supabase, provider, job });
        await vi.runAllTimersAsync(); // skip the retry backoff for retryable kinds
        await done;

        expect(db.rpc).toHaveBeenLastCalledWith("fail_generation_job", {
          p_job_id: "job-1",
          p_error_message: GENERATION_FAILURE_MESSAGES[kind],
        });
        expect(GENERATION_FAILURE_MESSAGES[kind]).not.toMatch(/stable|audio error|http/i);
        expect(db.upload).not.toHaveBeenCalled();
        expect(consoleError.mock.calls.flat().join(" ")).toContain("raw provider text");
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it("fails the job (still queued) without calling the provider when it cannot be started", async () => {
    const db = fakeSupabase({ rpcErrors: { start_generation_job: { message: "boom" } } });
    const { provider, generate } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(generate).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenLastCalledWith("fail_generation_job", {
      p_job_id: "job-1",
      p_error_message: GENERATION_UNEXPECTED_FAILURE_MESSAGE,
    });
  });

  it("fails the job when the upload is rejected, without completing it", async () => {
    const db = fakeSupabase({ uploadError: { message: "new row violates row-level security policy" } });
    const { provider } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(rpcNames(db.rpc)).toEqual(["start_generation_job", "fail_generation_job"]);
    expect(db.rpc).toHaveBeenLastCalledWith("fail_generation_job", {
      p_job_id: "job-1",
      p_error_message: GENERATION_UNEXPECTED_FAILURE_MESSAGE,
    });
  });

  it("fails the job and removes the uploaded object when the completion step fails", async () => {
    const db = fakeSupabase({ rpcErrors: { complete_generation_job: { message: "insert failed" } } });
    const { provider } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(rpcNames(db.rpc)).toEqual([
      "start_generation_job",
      "complete_generation_job",
      "fail_generation_job",
    ]);
    expect(db.remove).toHaveBeenCalledWith(["user-1/job-1.wav"]);
  });

  it("keeps the uploaded object when the job can no longer be marked failed (completion may have committed)", async () => {
    const db = fakeSupabase({
      rpcErrors: {
        complete_generation_job: { message: "connection reset" },
        fail_generation_job: { message: "cannot fail generation job from status completed" },
      },
    });
    const { provider } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(db.remove).not.toHaveBeenCalled();
  });

  it("lands the job in failed when the provider throws", async () => {
    const db = fakeSupabase();
    const { provider } = fakeProvider(async () => {
      throw new Error("bug");
    });

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(db.rpc).toHaveBeenLastCalledWith("fail_generation_job", {
      p_job_id: "job-1",
      p_error_message: GENERATION_UNEXPECTED_FAILURE_MESSAGE,
    });
  });

  it("lands the job in failed when the upload throws", async () => {
    const db = fakeSupabase({ uploadThrows: new Error("socket hang up") });
    const { provider } = fakeProvider(async () => success);

    await processGenerationJob({ supabase: db.supabase, provider, job });

    expect(db.rpc).toHaveBeenLastCalledWith("fail_generation_job", {
      p_job_id: "job-1",
      p_error_message: GENERATION_UNEXPECTED_FAILURE_MESSAGE,
    });
  });

  it("never rejects, even when marking the job failed throws", async () => {
    const db = fakeSupabase({ uploadThrows: new Error("socket hang up"), failRpcThrows: new Error("down") });
    const { provider } = fakeProvider(async () => success);

    await expect(processGenerationJob({ supabase: db.supabase, provider, job })).resolves.toBeUndefined();
  });
});
