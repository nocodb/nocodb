/**
 * The query-param spellings `getListArgs` collapses into one canonical arg,
 * listed in its precedence order (`args.where || args.filter || args.w`).
 *
 * Single source of truth on purpose: it is the ALIAS SET, not the canonical
 * name, that defines a route's reachable query surface, so the shared-view gate
 * derives its key list from here instead of maintaining a parallel one. A new
 * alias added to `getListArgs` alone would otherwise reopen that gate silently.
 */
export const LIST_ARG_ALIASES = {
  where: ['where', 'filter', 'w'],
  sort: ['sort', 's'],
  fields: ['fields', 'f'],
} as const;

/** Every spelling of `where` / `sort` / `fields`, flattened. */
export const LIST_ARG_ALIAS_KEYS: readonly string[] =
  Object.values(LIST_ARG_ALIASES).flat();

/**
 * The first alias carrying a value, in `getListArgs` precedence order.
 *
 * Note the asymmetry with the gate: resolution takes only the winner, but
 * sanitization rewrites EVERY present spelling — so a precedence change cannot
 * promote an unsanitized alias.
 */
export function resolveListArgAlias(
  args: Record<string, any>,
  aliases: readonly string[],
) {
  for (const key of aliases) {
    if (args?.[key]) return args[key];
  }
  return undefined;
}
