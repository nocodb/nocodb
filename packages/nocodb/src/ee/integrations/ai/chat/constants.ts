/** Maximum number of agentic tool-use steps per LLM turn. */
export const MAX_STEPS = +(process.env.NC_AI_MAX_STEPS || 40);

/** Single token budget for conversation history passed to the LLM.
 * Compaction and message building both use this as the source of truth. */
export const MAX_HISTORY_TOKENS = +(
  process.env.NC_AI_MAX_HISTORY_TOKENS || 8000
);

/** When estimated token usage exceeds this fraction of MAX_HISTORY_TOKENS, trigger compaction. */
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
