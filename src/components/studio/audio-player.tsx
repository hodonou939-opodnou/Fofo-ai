"use client";

export default function AudioPlayer({ jobId }: { jobId: string }) {
  const src = `/api/audio/${jobId}`;
  return (
    <div className="mt-4 flex flex-col gap-2">
      {/* preload="none": no signed-URL round trip until the user presses play */}
      <audio controls preload="none" src={src} className="w-full" />
      <a href={`${src}?download=1`} download className="text-sm underline w-fit">
        Télécharger
      </a>
    </div>
  );
}
