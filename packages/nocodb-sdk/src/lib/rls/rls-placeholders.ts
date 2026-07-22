import UITypes from '~/lib/UITypes';

/**
 * Dynamic placeholders usable in RLS policy filter values.
 *
 * These are substituted at query time from the authenticated user's context
 * (see `resolveRlsDynamicValues` in the backend). This module is the single
 * source of truth shared by the resolver, the write-time validator, and the
 * policy-editor picker.
 */

export type RlsPlaceholderToken =
  | '{currentUser.id}'
  | '{currentUser.email}'
  | '{currentUser.name}'
  | '{currentUser.roles}'
  | '{currentUser.teams}'
  | '{currentUser.teamsWithDescendants}'
  | '{currentUser.teamNames}'
  | '{currentUser.teamNamesWithDescendants}'
  | '{currentUser.teamWithDescendantMembers}';

export interface RlsPlaceholderDefinition {
  /**
   * `list` resolves to a comma-joined string and is meant for the
   * `anyof` family of operators, which split on commas.
   * `scalar` resolves to a single value, for `eq` / `like` / etc.
   */
  shape: 'scalar' | 'list';
  /**
   * What the resolved value contains — lets the picker offer only the
   * placeholders that make sense for the selected column.
   */
  produces: 'userId' | 'email' | 'displayName' | 'teamId' | 'teamName' | 'role';
  /** Key under `objects.permissions.rlsPolicy.placeholders` in en.json. */
  i18nKey: string;
  /**
   * Still resolved for policies that already use it, but hidden from the
   * picker so it isn't adopted in new policies.
   */
  deprecated?: boolean;
}

/**
 * Keyed by token string rather than an enum: a module-top-level map keyed by
 * enum members trips a Rollup crash in this package.
 */
export const RLS_PLACEHOLDERS = {
  '{currentUser.id}': {
    shape: 'scalar',
    produces: 'userId',
    i18nKey: 'currentUserId',
  },
  '{currentUser.email}': {
    shape: 'scalar',
    produces: 'email',
    i18nKey: 'currentUserEmail',
  },
  '{currentUser.name}': {
    shape: 'scalar',
    produces: 'displayName',
    i18nKey: 'currentUserName',
  },
  '{currentUser.roles}': {
    shape: 'list',
    produces: 'role',
    i18nKey: 'currentUserRoles',
    deprecated: true,
  },
  '{currentUser.teams}': {
    shape: 'list',
    produces: 'teamId',
    i18nKey: 'currentUserTeams',
  },
  '{currentUser.teamsWithDescendants}': {
    shape: 'list',
    produces: 'teamId',
    i18nKey: 'currentUserTeamsWithDescendants',
  },
  '{currentUser.teamNames}': {
    shape: 'list',
    produces: 'teamName',
    i18nKey: 'currentUserTeamNames',
  },
  '{currentUser.teamNamesWithDescendants}': {
    shape: 'list',
    produces: 'teamName',
    i18nKey: 'currentUserTeamNamesWithDescendants',
  },
  '{currentUser.teamWithDescendantMembers}': {
    shape: 'list',
    produces: 'userId',
    i18nKey: 'currentUserTeamWithDescendantMembers',
  },
} satisfies Record<RlsPlaceholderToken, RlsPlaceholderDefinition>;

export const RLS_PLACEHOLDER_TOKENS = Object.keys(
  RLS_PLACEHOLDERS
) as RlsPlaceholderToken[];

/** Operators that split their value on commas — the only place a list placeholder works. */
const RLS_LIST_OPERATORS = ['anyof', 'nanyof', 'allof', 'nallof'];

/**
 * Which placeholders make sense for a given column + operator.
 *
 * The `UITypes` lists live inside the function body on purpose — an
 * enum-valued const at module top level trips a Rollup crash in this package.
 */
export function getRlsPlaceholdersForColumn(param: {
  uidt?: UITypes;
  comparisonOp?: string | null;
}): RlsPlaceholderToken[] {
  const { uidt, comparisonOp } = param;

  const isListOperator = RLS_LIST_OPERATORS.includes(comparisonOp ?? '');

  const producesFits = (produces: RlsPlaceholderDefinition['produces']) => {
    // No column picked yet — offer everything and let the column narrow it later.
    if (!uidt) return true;

    // User-ish columns store user ids, and `eq`/`neq` are excluded for them, so
    // these only ever pair with the `anyof` family.
    if (
      [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(uidt)
    ) {
      return produces === 'userId';
    }

    if (uidt === UITypes.Email) return produces === 'email';

    if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(uidt)) {
      return produces === 'teamName';
    }

    // Free-text columns are used to hold any of these in practice. Everything
    // else (numeric, date, checkbox, attachment, …) can hold none of them, so
    // offering a placeholder there would only build a filter that never matches.
    return [
      UITypes.SingleLineText,
      UITypes.LongText,
      UITypes.PhoneNumber,
      UITypes.URL,
    ].includes(uidt);
  };

  return (
    Object.entries(RLS_PLACEHOLDERS) as [
      RlsPlaceholderToken,
      RlsPlaceholderDefinition
    ][]
  )
    .filter(([, def]) => !def.deprecated)
    .filter(([, def]) => def.shape === 'scalar' || isListOperator)
    .filter(([, def]) => producesFits(def.produces))
    .map(([token]) => token);
}

/**
 * Matches anything placeholder-shaped, including tokens we don't support —
 * that's what makes typo detection possible.
 */
const RLS_PLACEHOLDER_PATTERN = /\{currentUser\.[^}]*\}/g;

function toStringParts(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value))
    return value.filter((part): part is string => typeof part === 'string');
  return [];
}

/** True when the value contains at least one supported placeholder. */
export function hasRlsPlaceholder(value: unknown): boolean {
  return toStringParts(value).some((part) =>
    RLS_PLACEHOLDER_TOKENS.some((token) => part.includes(token))
  );
}

/**
 * Placeholder-shaped tokens in the value that the resolver does not understand.
 *
 * Unknown tokens are not substituted, so they reach SQL as literal text and
 * silently change what the policy matches — hence rejecting them at write time.
 */
export function findUnknownRlsPlaceholders(value: unknown): string[] {
  const unknown = new Set<string>();

  for (const part of toStringParts(value)) {
    for (const match of part.match(RLS_PLACEHOLDER_PATTERN) ?? []) {
      if (!RLS_PLACEHOLDER_TOKENS.includes(match as RlsPlaceholderToken)) {
        unknown.add(match);
      }
    }
  }

  return [...unknown];
}
