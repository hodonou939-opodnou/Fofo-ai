// Per-user generation rate limit (spec §9: 10/hour by default). The count and
// the check run atomically inside the create_generation_job SQL function
// (migration 0005); this constant is passed to it and stays the single source
// of truth for the limit.
export const MAX_GENERATIONS_PER_HOUR = 10;

// SQLSTATE raised by create_generation_job when the limit is reached.
export const RATE_LIMIT_EXCEEDED_CODE = "PT429";
