/**
 * Shared Exa client singleton for web tools.
 *
 * Uses exa-js SDK with the EXA_API_KEY env var.
 */
import Exa from 'exa-js';
import { EXA_API_KEY } from '~/integrations/ai/chat/constants';

let _client: Exa | null = null;
let _initialized = false;

export function exaClient(): Exa | null {
  if (_initialized) return _client;
  _initialized = true;

  if (!EXA_API_KEY) return null;

  _client = new Exa(EXA_API_KEY);
  return _client;
}

/**
 * Returns true if the Exa API key is configured.
 */
export function isExaEnabled(): boolean {
  return !!EXA_API_KEY;
}
