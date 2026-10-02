"use client";

export default function AudioPlayer({ jobId }: { jobId: string }) {
  const src = `/api/audio/${jobId}`;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <audio controls src={src} className="w-full" />
      <a href={src} download className="text-sm underline w-fit">
        Télécharger
      </a>
    </div>
  );
}
