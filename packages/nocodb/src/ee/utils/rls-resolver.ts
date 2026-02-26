import type { RlsDefaultBehavior, RlsPolicySubjectType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Filter from '~/models/Filter';
import RlsPolicy from '~/ee/models/RlsPolicy';
import { isUserInTeamOrDescendants } from '~/ee/utils/team-subject-matcher';

export interface RlsUserContext {
  id: string;
  email?: string;
  roles?: string; // comma-separated base roles
  teams?: string[]; // direct team IDs the user belongs to
  teamsWithDescendants?: string[]; // all team IDs including descendants of user's teams
  teamDescendantMemberUserIds?: string[]; // user IDs of members across user's teams + descendants
}

export interface RlsResolutionResult {
  type: 'no_rls' | 'filters' | 'deny_all';
  filters?: Filter[];
}

/**
 * Dynamic value placeholders that can be used in RLS filter values.
 * These are resolved at query time based on the authenticated user's context.
 */
const DYNAMIC_PLACEHOLDERS = {
  '{currentUser.id}': (user: RlsUserContext) => user.id,
  '{currentUser.email}': (user: RlsUserContext) => user.email || '',
  '{currentUser.roles}': (user: RlsUserContext) => user.roles || '',
  '{currentUser.teams}': (user: RlsUserContext) => user.teams?.join(',') || '',
  '{currentUser.teamWithDescendantMembers}': (user: RlsUserContext) =>
    user.teamDescendantMemberUserIds?.join(',') || '',
};

/**
 * Check if a user matches any subject in a policy.
 */
async function userMatchesSubjects(
  context: NcContext,
  user: RlsUserContext,
  subjects: RlsPolicySubjectType[],
): Promise<boolean> {
  for (const subject of subjects) {
    switch (subject.type) {
      case 'role':
        // Check if user's effective base role matches
        if (user.roles) {
          const userRoles = user.roles.split(',').map((r) => r.trim());
          if (userRoles.includes(subject.id)) {
            return true;
          }
        }
        break;

      case 'team':
        {
          // Fast path: check direct membership via pre-loaded teams
          if (user.teams?.includes(subject.id)) {
            return true;
          }

          // Full check with descendant expansion via DB
          // isUserInTeamOrDescendants expands the SUBJECT team to include its descendants,
          // then checks if the user is a member of any of them.
          const matched = await isUserInTeamOrDescendants(
            context,
            user.id,
            subject.id,
            subject.hierarchy_scope,
          );
          if (matched) {
            return true;
          }
        }
        break;

      case 'user':
        if (user.id === subject.id) {
          return true;
        }
        break;
    }
  }
  return false;
}

/**
 * Resolve which RLS policies apply to the current user for a given table.
 *
 * Algorithm:
 * 1. Fetch all enabled policies for the model (cached)
 * 2. If no policies exist → no RLS (return null)
 * 3. Separate default policy from scoped policies
 * 4. For each scoped policy, check if user matches ANY subject
 * 5. If scoped matches → OR all matched policies' filters
 * 6. If no scoped matches → apply default policy behavior
 * 7. If no default → return null (all rows visible)
 */
export async function resolveRlsPolicies(
  context: NcContext,
  modelId: string,
  user: RlsUserContext,
): Promise<RlsResolutionResult> {
  // 1. Fetch all enabled policies for this model
  const allPolicies = await RlsPolicy.listByModel(context, modelId);

  const enabledPolicies = allPolicies.filter((p) => p.enabled);

  // 2. No policies → no RLS
  if (enabledPolicies.length === 0) {
    return { type: 'no_rls' };
  }

  // 3. Separate default from scoped
  const defaultPolicy = enabledPolicies.find((p) => p.is_default);
  const scopedPolicies = enabledPolicies.filter((p) => !p.is_default);

  // 4. Check which scoped policies match the user
  const matchedPolicies: RlsPolicy[] = [];

  for (const policy of scopedPolicies) {
    if (policy.subjects && policy.subjects.length > 0) {
      const matches = await userMatchesSubjects(context, user, policy.subjects);
      if (matches) {
        matchedPolicies.push(policy);
      }
    }
  }

  // 5. If we have scoped matches → use their filters (OR'd together)
  if (matchedPolicies.length > 0) {
    return { type: 'filters', filters: [] }; // Filters loaded separately
  }

  // 6. If no scoped matches → fall back to default policy
  if (defaultPolicy) {
    const behavior: RlsDefaultBehavior =
      defaultPolicy.default_behavior || 'show_all';
    switch (behavior) {
      case 'show_all':
        return { type: 'no_rls' };
      case 'deny_all':
        return { type: 'deny_all' };
      case 'condition':
        return { type: 'filters', filters: [] }; // Default policy filters loaded separately
    }
  }

  // 7. No matches and no default → all rows visible
  return { type: 'no_rls' };
}

/**
 * Substitute dynamic placeholders in filter values with actual user context values.
 * This is called after policy resolution and before conditionV2 processing.
 */
export function resolveRlsDynamicValues(
  filters: any[],
  user: RlsUserContext,
): any[] {
  if (!filters || !filters.length) return filters;

  return filters.map((filter) => {
    const resolved = { ...filter };

    // Recurse into children (for group filters)
    if (resolved.children && Array.isArray(resolved.children)) {
      resolved.children = resolveRlsDynamicValues(resolved.children, user);
    }

    // Substitute placeholders in value
    if (resolved.value && typeof resolved.value === 'string') {
      for (const [placeholder, resolver] of Object.entries(
        DYNAMIC_PLACEHOLDERS,
      )) {
        if (resolved.value.includes(placeholder)) {
          resolved.value = resolved.value.replace(placeholder, resolver(user));
        }
      }
    }

    return resolved;
  });
}

/**
 * TODO: Discuss behavior with team and decide if we want this
 * 
 * Extract auto-fill defaults from matching RLS policies for insert operations.
 * Only extracts from equality conditions with dynamic values.
 *
 * Example: If policy says `Assigned To eq {currentUser.id}`, returns
 * `{ cl_assigned_to: 'user123' }` so the insert auto-fills the field.
 *
export function getRlsAutoDefaults(
  filters: any[],
  user: RlsUserContext,
): Record<string, string> {
  const defaults: Record<string, string> = {};

  if (!filters || !filters.length) return defaults;

  for (const filter of filters) {
    // Only auto-fill for equality operators with dynamic values
    if (
      filter.fk_column_id &&
      (filter.comparison_op === 'eq' || filter.comparison_op === 'is') &&
      filter.value &&
      typeof filter.value === 'string'
    ) {
      // Check if value contains a dynamic placeholder
      for (const [placeholder, resolver] of Object.entries(
        DYNAMIC_PLACEHOLDERS,
      )) {
        if (filter.value === placeholder) {
          defaults[filter.fk_column_id] = resolver(user);
          break;
        }
      }
    }

    // Recurse into children
    if (filter.children && Array.isArray(filter.children)) {
      Object.assign(defaults, getRlsAutoDefaults(filter.children, user));
    }
  }

  return defaults;
}
*/
