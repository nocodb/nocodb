/** Maximum number of agentic tool-use steps per LLM turn. */
export const MAX_STEPS = 10;

/** Approximate token budget for conversation history passed to the LLM. */
export const MAX_HISTORY_TOKENS = 8000;

/** When estimated token usage exceeds this fraction of TOKEN_BUDGET, trigger compaction. */
export const COMPACTION_THRESHOLD = 0.8;

/** Total token budget for the compacted conversation window. */
export const TOKEN_BUDGET = 16000;

/** Number of most-recent messages to always keep uncompacted. */
export const KEEP_RECENT_MESSAGES = 6;

/** Default max character length for truncated tool results. */
export const TRUNCATE_RESULT_MAX_LENGTH = 4000;

/** Max characters kept from an error message when building an LLM-facing hint. */
export const ERROR_HINT_MAX_LENGTH = 128;

/** Maximum allowed length for a single user chat message. */
export const MESSAGE_MAX_LENGTH = 10_000;
