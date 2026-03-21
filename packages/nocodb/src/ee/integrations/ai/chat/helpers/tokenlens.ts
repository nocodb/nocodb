import { countTokens, getContextLimits } from 'tokenlens';
import { Logger } from '@nestjs/common';
import {
  HISTORY_FRACTION,
  MAX_DYNAMIC_HISTORY_TOKENS,
  MAX_HISTORY_TOKENS,
  MIN_HISTORY_TOKENS,
} from '~/integrations/ai/chat/constants';

const logger = new Logger('Tokenlens');

const countTokensSupported = new Map<string, boolean>();

export async function getModelContextLimits(
  modelId: string,
): Promise<number | null> {
  try {
    const limits = await getContextLimits({ modelId });

    if (limits?.context) {
      return limits.context;
    }

    const openrouterModelId = modelId.includes('/')
      ? modelId
      : `openrouter/${modelId}`;

    const limitsRetry = await getContextLimits({
      modelId: openrouterModelId,
    });
    if (limitsRetry?.context) {
      return limitsRetry.context;
    }

    logger.warn(`No context limits found for model "${modelId}"`);
    return null;
  } catch (e) {
    logger.warn(`Failed to get context limits for "${modelId}": ${e.message}`);
    return null;
  }
}

export async function getHistoryBudget(
  modelId: string | undefined,
): Promise<number> {
  if (!modelId) return MAX_HISTORY_TOKENS;

  const contextSize = await getModelContextLimits(modelId);
  if (!contextSize) return MAX_HISTORY_TOKENS;

  const budget = Math.floor(contextSize * HISTORY_FRACTION);
  return Math.min(
    MAX_DYNAMIC_HISTORY_TOKENS,
    Math.max(MIN_HISTORY_TOKENS, budget),
  );
}

export async function estimateTokens(
  text: string,
  modelId?: string,
): Promise<number> {
  if (!text) return 0;

  if (modelId && countTokensSupported.get(modelId) !== false) {
    try {
      const count = await countTokens({ modelId, data: text });
      countTokensSupported.set(modelId, true);
      return count;
    } catch {
      countTokensSupported.set(modelId, false);
    }
  }

  return Math.ceil(text.length / 4);
}
