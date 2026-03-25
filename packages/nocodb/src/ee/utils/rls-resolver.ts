import type { RlsDefaultBehavior, RlsPolicySubjectType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import RlsPolicy from '~/models/RlsPolicy';
import { matchTeamSubjectsBatch } from '~/utils/team-subject-matcher';

export interface RlsUserContext {
  id: string;
  email?: string;
  roles?: string; // comma-separated base roles
  teams?: string[]; // direct team IDs the user belongs to
  teamDescendantMemberUserIds?: string[]; // user IDs of members across user's teams + descendants
}

export interface RlsResolutionResult {
  type: 'no_rls' | 'filters' | 'deny_all';
  matchedPolicyIds?: string[];
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
 * Check if a user matches any role or user subject (no DB needed).
 */
function matchesRoleOrUserSubject(
  user: RlsUserContext,
  subjects: RlsPolicySubjectType[],
): boolean {
  const userRoles = user.roles
    ? user.roles.split(',').map((r) => r.trim())
    : [];

  for (const subject of subjects) {
    if (subject.type === 'role' && userRoles.includes(subject.id)) {
      return true;
    }
    if (subject.type === 'user' && user.id === subject.id) {
      return true;
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
 * 4. Match role/user subjects immediately (no DB), batch team subjects
 * 5. If scoped matches → OR all matched policies' filters
 * 6. If no scoped matches → apply default policy behavior
 * 7. If no default → return null (all rows visible)
 */
export async function resolveRlsPolicies(
  context: NcContext,
  modelId: string,
  user: RlsUserContext,
  options?: { teamResolutionFailed?: boolean },
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

  // 4a. If team resolution failed and any scoped policy has team subjects,
  // fail closed — we can't reliably determine access without team data
  if (options?.teamResolutionFailed) {
    const hasTeamSubjects = scopedPolicies.some((p) =>
      p.subjects?.some((s) => s.type === 'team'),
    );
    if (hasTeamSubjects) {
      return { type: 'deny_all' };
    }
  }

  // 4b. Match role/user subjects immediately (no DB queries)
  const matchedPolicies: RlsPolicy[] = [];
  const policiesNeedingTeamCheck: RlsPolicy[] = [];

  for (const policy of scopedPolicies) {
    if (!policy.subjects?.length) continue;

    if (matchesRoleOrUserSubject(user, policy.subjects)) {
      matchedPolicies.push(policy);
    } else if (policy.subjects.some((s) => s.type === 'team')) {
      policiesNeedingTeamCheck.push(policy);
    }
  }

  // 4c. Batch team subject matching across all remaining policies
  if (policiesNeedingTeamCheck.length > 0) {
    // Collect all unique team subjects across all policies
    const allTeamSubjects: {
      id: string;
      hierarchy_scope?: string;
    }[] = [];
    const seen = new Set<string>();
    for (const policy of policiesNeedingTeamCheck) {
      for (const s of policy.subjects!) {
        if (s.type === 'team' && !seen.has(s.id)) {
          seen.add(s.id);
          allTeamSubjects.push({
            id: s.id,
            hierarchy_scope: s.hierarchy_scope,
          });
        }
      }
    }

    // Single batch call for all team subjects
    const matchedTeamIds = await matchTeamSubjectsBatch(
      context,
      user.id,
      user.teams || [],
      allTeamSubjects,
    );

    // Check which policies matched via team subjects
    for (const policy of policiesNeedingTeamCheck) {
      const hasTeamMatch = policy.subjects!.some(
        (s) => s.type === 'team' && matchedTeamIds.has(s.id),
      );
      if (hasTeamMatch) {
        matchedPolicies.push(policy);
      }
    }
  }

  // 5. If we have scoped matches → use their filters (OR'd together)
  if (matchedPolicies.length > 0) {
    return {
      type: 'filters',
      matchedPolicyIds: matchedPolicies.map((p) => p.id),
    };
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
        return {
          type: 'filters',
          matchedPolicyIds: [defaultPolicy.id],
        };
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
