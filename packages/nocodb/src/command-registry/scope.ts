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

const requireScopeId = (
  id: string | undefined | null,
  type: string,
): string => {
  if (!id) throw new Error(`scope${type}: id is required`);
  return id;
};

export const scopeTable = (id: string | undefined | null): ScopeRef => ({
  type: 'table',
  id: requireScopeId(id, 'Table'),
});
export const scopeView = (id: string | undefined | null): ScopeRef => ({
  type: 'view',
  id: requireScopeId(id, 'View'),
});
export const scopeDashboard = (id: string | undefined | null): ScopeRef => ({
  type: 'dashboard',
  id: requireScopeId(id, 'Dashboard'),
});
export const scopeWorkflow = (id: string | undefined | null): ScopeRef => ({
  type: 'workflow',
  id: requireScopeId(id, 'Workflow'),
});
export const scopeScript = (id: string | undefined | null): ScopeRef => ({
  type: 'script',
  id: requireScopeId(id, 'Script'),
});

/**
 * Body fields treated as sidebar-class for each rename-capable `*Update`
 * op. Enumerated rather than blacklisted: a new field defaults to the
 * entity-scope branch unless explicitly added here, which is the safer
 * direction for future schema growth.
 */
export const SIDEBAR_FIELDS = {
  viewUpdate: new Set<string>([
    'title',
    'lock_type',
    'fk_view_section_id',
    'order',
  ]),
  dashboardUpdate: new Set<string>(['title', 'order']),
  workflowUpdate: new Set<string>(['title', 'order']),
  scriptUpdate: new Set<string>(['title', 'order']),
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
