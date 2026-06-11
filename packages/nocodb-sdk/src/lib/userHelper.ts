import { CURRENT_USER_TOKEN } from '~/lib/globals';

/**
 * Resolve `@me` tokens in a comma-separated user default value string,
 * replacing them with the given userId and deduplicating the result.
 */
export function resolveCurrentUserToken(
  cdf: string,
  userId: string,
): string {
  return [
    ...new Set(
      cdf
        .split(',')
        .map((v) =>
          v.trim() === CURRENT_USER_TOKEN ? userId : v.trim(),
        )
        .filter(Boolean),
    ),
  ].join(',');
}
