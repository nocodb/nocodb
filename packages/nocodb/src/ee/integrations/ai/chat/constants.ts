/** Fallback history budget when tokenlens can't resolve the model */
export const MAX_HISTORY_TOKENS = +(
  process.env.NC_AI_MAX_HISTORY_TOKENS || 8000
);

/** Fraction of the model's context window used for history */
export const HISTORY_FRACTION = +(process.env.NC_AI_HISTORY_FRACTION || 0.6);

/** Floor for dynamic history budget */
export const MIN_HISTORY_TOKENS = +(
  process.env.NC_AI_MIN_HISTORY_TOKENS || 8_000
);

/** Ceiling for dynamic history budget */
export const MAX_DYNAMIC_HISTORY_TOKENS = +(
  process.env.NC_AI_MAX_DYNAMIC_HISTORY_TOKENS || 128_000
);

export const COMPACTION_THRESHOLD = +(
  process.env.NC_AI_COMPACTION_THRESHOLD || 0.8
);

/** Number of most-recent messages to always keep uncompacted. */
export const KEEP_RECENT_MESSAGES = +(
  process.env.NC_AI_KEEP_RECENT_MESSAGES || 6
);

/** Default max character length for truncated tool results.
 * ~30k chars ≈ 7500 tokens — generous enough for large record sets
 * while staying well within the history budget after compaction. */
export const TRUNCATE_RESULT_MAX_LENGTH = +(
  process.env.NC_AI_TRUNCATE_RESULT_MAX_LENGTH || 30_000
);

/** Max characters kept from an error message when building an LLM-facing hint. */
export const ERROR_HINT_MAX_LENGTH = +(
  process.env.NC_AI_ERROR_HINT_MAX_LENGTH || 128
);

/** Maximum allowed length for a single user chat message. */
export const MESSAGE_MAX_LENGTH = +(
  process.env.NC_AI_MESSAGE_MAX_LENGTH || 10_000
);

export const MAX_ROUNDS = +(process.env.NC_AI_MAX_ROUNDS || 12);

export const ROUTER_MAX_TURNS = 1;

// ─── External service keys ──────────────────────────────────────────────────

/** Exa API key for web search/scrape tools */
export const EXA_API_KEY = process.env.EXA_API_KEY || '';

/** E2B sandbox API key for code execution */
export const E2B_API_KEY = process.env.E2B_API_KEY || '';

/** E2B sandbox template ID */
export const E2B_TEMPLATE_ID =
  process.env.E2B_TEMPLATE_ID || 'e2b/code-interpreter-v1';
