"use client";

import { useState } from "react";
import GenerationForm from "./generation-form";
import JobStatus from "./job-status";

export default function StudioClient({ rhythms }: { rhythms: { slug: string; name: string }[] }) {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div>
      <GenerationForm rhythms={rhythms} onJobCreated={setJobId} />
      {jobId && <JobStatus jobId={jobId} />}
    </div>
  );
}
