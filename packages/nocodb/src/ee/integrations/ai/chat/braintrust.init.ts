/**
 * Braintrust tracing for the NocoDB Chat agent.
 *
 * Activates only when NC_BRAINTRUST_API_KEY is set.
 * All streamText / generateText calls are automatically captured as child spans.
 * Use chatTraced() to create a per-turn root span.
 */

import * as vercelAi from 'ai';
import { initLogger, wrapAISDK } from 'braintrust';

type AiModule = typeof vercelAi;

let _ai: AiModule = vercelAi;
let _logger: ReturnType<typeof initLogger> | null = null;

function initBraintrustTracing(): void {
  const apiKey = process.env.NC_BRAINTRUST_API_KEY;
  if (!apiKey) return;

  try {
    _logger = initLogger({
      projectName: process.env.NC_BRAINTRUST_PROJECT ?? 'NocoDB',
      apiKey,
      asyncFlush: true,
    });

    _ai = wrapAISDK(vercelAi);
  } catch (e: any) {
    console.error('[Braintrust] Failed to initialize tracing:', e?.message);
  }
}

// Runs once at module load — no explicit call needed in consuming code.
initBraintrustTracing();

/** Wrapped AI SDK — streamText/generateText auto-create child spans when tracing is active. */
export const chatAi = {
  get streamText() {
    return _ai.streamText;
  },
  get generateText() {
    return _ai.generateText;
  },
};

/**
 * Log user feedback (thumbs up/down) against a Braintrust span.
 * score: 1 = positive, 0 = negative.
 * No-op when Braintrust is not configured.
 */
export function chatLogFeedback(
  spanId: string,
  score: 1 | 0,
  comment?: string,
): void {
  if (!_logger || !spanId) return;
  _logger.logFeedback({
    id: spanId,
    scores: { user_feedback: score },
    ...(comment ? { comment } : {}),
  });
}

/**
 * Wraps an async function in a Braintrust span.
 * If tracing is not configured, runs the function directly.
 * Nested calls automatically become child spans via AsyncLocalStorage.
 */
export async function chatTraced<T>(
  name: string,
  fn: (span: any) => Promise<T>,
  opts?: {
    metadata?: Record<string, unknown>;
    type?: 'task' | 'function' | 'tool';
  },
): Promise<T> {
  if (!_logger) return fn(null);
  return _logger.traced(
    async (span) => {
      if (opts?.metadata) span.log({ metadata: opts.metadata });
      return fn(span);
    },
    { name, type: opts?.type ?? 'task' },
  );
}
