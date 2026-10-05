import type { GenerationFailureKind } from "./provider";

// What the user reads when a job fails (stored in generation_jobs.error_message
// and shown as-is by the Studio). No provider name and no infrastructure
// detail: those go to the server logs. The stale-job timeout message lives in
// the fail_stale_generation_jobs SQL function (migration 0005).
export const GENERATION_FAILURE_MESSAGES: Record<GenerationFailureKind, string> = {
  timeout: "La génération a pris trop de temps. Réessaie dans quelques instants.",
  unavailable:
    "Le service de génération est momentanément indisponible. Réessaie dans quelques instants.",
  refused: "Ta description n'a pas pu être utilisée. Reformule-la et réessaie.",
  invalid: "Ta demande n'a pas pu être traitée telle quelle. Modifie-la et réessaie.",
};

// Anything that is not a categorized provider failure (storage, database, bug).
export const GENERATION_UNEXPECTED_FAILURE_MESSAGE =
  "La génération a échoué. Réessaie dans quelques instants.";
