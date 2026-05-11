import type { NcContext } from '~/interface/config';
import type { ScopeRef } from './types';

/**
 * Tiny builders so contracts read declaratively:
 *
 *   scope: (p) => scopeView(p.viewId)
 *   scope: (_, __, ___, ctx) => scopeBase(ctx)
 *
 * `scopeBase` throws if `context.base_id` is missing — every operation we
 * trace runs against a base, so this should never be hit at runtime; it's
 * a stronger signal than silently emitting `id: undefined`.
 */
export const scopeBase = (context: NcContext): ScopeRef => {
  if (!context?.base_id) {
    throw new Error('scopeBase: context.base_id is required');
  }
  return { type: 'base', id: context.base_id };
};

export const scopeTable = (id: string): ScopeRef => ({ type: 'table', id });
export const scopeView = (id: string): ScopeRef => ({ type: 'view', id });
export const scopeDashboard = (id: string): ScopeRef => ({
  type: 'dashboard',
  id,
});
export const scopeWorkflow = (id: string): ScopeRef => ({
  type: 'workflow',
  id,
});
export const scopeScript = (id: string): ScopeRef => ({ type: 'script', id });

/**
 * Body fields treated as sidebar-class for each rename-capable `*Update`
 * op. Enumerated rather than blacklisted: a new field defaults to the
 * entity-scope branch unless explicitly added here, which is the safer
 * direction for future schema growth.
 */
export const SIDEBAR_FIELDS = {
  viewUpdate: new Set<string>(['title', 'lock_type', 'fk_view_section_id']),
  dashboardUpdate: new Set<string>(['title']),
  workflowUpdate: new Set<string>(['title']),
  scriptUpdate: new Set<string>(['title']),
} as const;

export type DynamicScopeOp = keyof typeof SIDEBAR_FIELDS;

/**
 * Option-A dynamic scope: if every key on `body` is a sidebar field for
 * this op, the op lands on the base stack; otherwise on the entity stack.
 * Empty body → base (no-op renames don't need an editor).
 */
export function dynamicScope(
  op: DynamicScopeOp,
  body: Record<string, unknown> | undefined | null,
  base: ScopeRef,
  entity: ScopeRef,
): ScopeRef {
  const keys = body ? Object.keys(body) : [];
  if (keys.length === 0) return base;
  const sidebar = SIDEBAR_FIELDS[op];
  return keys.every((k) => sidebar.has(k)) ? base : entity;
}
