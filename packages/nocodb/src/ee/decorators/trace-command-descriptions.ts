/**
 * Bold-wrap a title for changelog descriptions (plain markdown bold).
 * Returns '' for undefined/empty so callers don't need to guard.
 */
export const b = (t?: string) => (t ? `**${t}**` : '');

/**
 * Entity sentinel helpers. Emit `[[kind:title]]` tokens that the frontend
 * renders as `<icon> <strong>title</strong>`. Any kind not listed here
 * falls back to a plain bold title in the UI.
 *
 * Keep the `:` separator in sync with the frontend parser:
 *   `nc-gui/ee/utils/changelogTokens.ts`
 */
const token = (kind: string) => (t?: string) => t ? `[[${kind}:${t}]]` : '';

export const bTable = token('table');
export const bView = token('view');
export const bField = token('field');
export const bDashboard = token('dashboard');
export const bWidget = token('widget');
export const bHook = token('hook');
export const bScript = token('script');
export const bWorkflow = token('workflow');
export const bBaseVariable = token('baseVariable');
export const bSync = token('sync');
export const bExtension = token('extension');
export const bViewSection = token('viewSection');
export const bRecordTemplate = token('recordTemplate');
export const bDateDependency = token('dateDependency');
export const bDocument = token('document');
export const bRlsPolicy = token('rlsPolicy');

import type { DescCtx, DescFn } from 'src/command-registry/types';
export type { DescCtx, DescFn };

type BFn = (t?: string) => string;

/**
 * Build the standard CRUD + rename action set for an entity kind.
 *
 *   add:    "Add {bEntity(title)} {type}"                [+ " to {bParent(parent)}"]
 *   edit:   "Edit configuration of {bEntity(title)} {type}" [+ " in {bParent(parent)}"]
 *   delete: "Delete {bEntity(title)} {type}"             [+ " from {bParent(parent)}"]
 *   rename: "Rename {bEntity(old)} {type} to {bEntity(new)}"
 *             [+ " in {bParent(parent)}"] — falls back to "Rename {type} to {bEntity(new)}"
 *             when oldTitle is missing
 */
function buildActions(bEntity: BFn, typeLabel: string, bParent?: BFn) {
  const withParent = (base: string, parent?: string) =>
    parent && bParent ? `${base} in ${bParent(parent)}` : base;

  return {
    add: (({ entityTitle, parentEntityTitle }) =>
      parentEntityTitle && bParent
        ? `Add ${bEntity(entityTitle)} ${typeLabel} to ${bParent(
            parentEntityTitle,
          )}`
        : `Add ${bEntity(entityTitle)} ${typeLabel}`) as DescFn,
    edit: (({ entityTitle, parentEntityTitle }) =>
      withParent(
        `Edit configuration of ${bEntity(entityTitle)} ${typeLabel}`,
        parentEntityTitle,
      )) as DescFn,
    delete: (({ entityTitle, parentEntityTitle }) =>
      parentEntityTitle && bParent
        ? `Delete ${bEntity(entityTitle)} ${typeLabel} from ${bParent(
            parentEntityTitle,
          )}`
        : `Delete ${bEntity(entityTitle)} ${typeLabel}`) as DescFn,
    rename: (({ entityTitle, parentEntityTitle, extra }) => {
      const oldTitle = extra?.oldTitle;
      const renamed =
        oldTitle && oldTitle !== entityTitle
          ? `Rename ${bEntity(oldTitle)} ${typeLabel} to ${bEntity(
              entityTitle,
            )}`
          : `Rename ${typeLabel} to ${bEntity(entityTitle)}`;
      return withParent(renamed, parentEntityTitle);
    }) as DescFn,
  };
}

export const tableActions = buildActions(bTable, 'table');
export const fieldActions = {
  ...buildActions(bField, 'field', bTable),
  setAsPrimary: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Set ${bField(entityTitle)} as primary field in ${bTable(
          parentEntityTitle,
        )}`
      : `Set ${bField(entityTitle)} as primary field`) as DescFn,
};
export const viewActions = buildActions(bView, 'view', bTable);
export const hookActions = buildActions(bHook, 'webhook', bTable);
export const dashboardActions = buildActions(bDashboard, 'dashboard');
export const widgetActions = buildActions(bWidget, 'widget', bDashboard);
export const scriptActions = buildActions(bScript, 'script');
export const workflowActions = buildActions(bWorkflow, 'workflow');
export const baseVariableActions = buildActions(bBaseVariable, 'variable');
export const syncActions = buildActions(bSync, 'sync');
export const extensionActions = buildActions(bExtension, 'extension');
export const viewSectionActions = buildActions(bViewSection, 'view section');
export const recordTemplateActions = buildActions(
  bRecordTemplate,
  'record template',
);

export const recordActions = {
  insert: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Insert record in ${bTable(parentEntityTitle)}`
      : `Insert record`) as DescFn,
  insertUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo record insert in ${bTable(parentEntityTitle)}`
      : `Undo record insert`) as DescFn,
  bulkInsert: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Bulk insert records in ${bTable(parentEntityTitle)}`
      : `Bulk insert records`) as DescFn,
  bulkInsertUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo bulk insert in ${bTable(parentEntityTitle)}`
      : `Undo bulk insert`) as DescFn,
  delete: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Delete record from ${bTable(parentEntityTitle)}`
      : `Delete record`) as DescFn,
  deleteUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo record delete in ${bTable(parentEntityTitle)}`
      : `Undo record delete`) as DescFn,
  update: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Update record in ${bTable(parentEntityTitle)}`
      : `Update record`) as DescFn,
  updateUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo record update in ${bTable(parentEntityTitle)}`
      : `Undo record update`) as DescFn,
  bulkUpdate: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Bulk update records in ${bTable(parentEntityTitle)}`
      : `Bulk update records`) as DescFn,
  bulkUpdateUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo bulk update in ${bTable(parentEntityTitle)}`
      : `Undo bulk update`) as DescFn,
  bulkDelete: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Bulk delete records from ${bTable(parentEntityTitle)}`
      : `Bulk delete records`) as DescFn,
  bulkDeleteUndo: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Undo bulk delete in ${bTable(parentEntityTitle)}`
      : `Undo bulk delete`) as DescFn,
  bulkUpsert: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Bulk upsert records in ${bTable(parentEntityTitle)}`
      : `Bulk upsert records`) as DescFn,
};

/**
 * Nested-under-view action (filters, sorts, row-color conditions).
 * The entity has:
 *   - a column it operates on      → extra.fieldTitle
 *   - a view it lives in           → parentEntityTitle
 *   - a table the view belongs to  → extra.tableTitle (populated by resolveCtx)
 *
 * Example output:
 *   "Add filter on {bField(Title)} in {bView(Hello)} in {bTable(Features)}"
 */
const nestedUnderView =
  (verb: string, typeLabel: string, fieldPreposition: string): DescFn =>
  ({ parentEntityTitle, extra }) => {
    const parts = [`${verb} ${typeLabel}`];
    if (extra?.fieldTitle)
      parts.push(`${fieldPreposition} ${bField(extra.fieldTitle)}`);
    if (parentEntityTitle) parts.push(`in ${bView(parentEntityTitle)}`);
    if (extra?.tableTitle) parts.push(`in ${bTable(extra.tableTitle)}`);
    return parts.join(' ');
  };

export const filterActions = {
  add: nestedUnderView('Add', 'filter', 'on'),
  edit: nestedUnderView('Edit', 'filter', 'on'),
  delete: nestedUnderView('Delete', 'filter', 'on'),
  replace: (({ parentEntityTitle, extra }) => {
    const parts = ['Replace filters'];
    if (parentEntityTitle) parts.push(`in ${bView(parentEntityTitle)}`);
    if (extra?.tableTitle) parts.push(`in ${bTable(extra.tableTitle)}`);
    return parts.join(' ');
  }) as DescFn,
  deleteAll: (({ parentEntityTitle, extra }) => {
    const parts = ['Clear all filters'];
    if (parentEntityTitle) parts.push(`from ${bView(parentEntityTitle)}`);
    if (extra?.tableTitle) parts.push(`in ${bTable(extra.tableTitle)}`);
    return parts.join(' ');
  }) as DescFn,
};

export const sortActions = {
  add: nestedUnderView('Add', 'sort', 'by'),
  edit: nestedUnderView('Edit', 'sort', 'by'),
  delete: nestedUnderView('Delete', 'sort', 'by'),
};

export const rowColorConditionActions = {
  add: nestedUnderView('Add', 'row color filter', 'on'),
  edit: nestedUnderView('Edit', 'row color filter', 'on'),
  delete: nestedUnderView('Delete', 'row color filter', 'on'),
};

export const rowColoringActions = {
  selectSet: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Set row coloring on ${bView(parentEntityTitle)}`
      : `Set row coloring`) as DescFn,
  remove: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Remove row coloring from ${bView(parentEntityTitle)}`
      : `Remove row coloring`) as DescFn,
  restore: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Restore row coloring on ${bView(parentEntityTitle)}`
      : `Restore row coloring`) as DescFn,
};

export const dateDependencyActions = {
  edit: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Edit date dependencies in ${bTable(parentEntityTitle)}`
      : `Edit date dependencies`) as DescFn,
  delete: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Remove date dependencies from ${bTable(parentEntityTitle)}`
      : `Remove date dependencies`) as DescFn,
};

export const viewColumnActions = {
  update: (({ parentEntityTitle, extra }) => {
    const parts = ['Edit field visibility'];
    if (parentEntityTitle) parts.push(`in ${bView(parentEntityTitle)}`);
    if (extra?.tableTitle) parts.push(`in ${bTable(extra.tableTitle)}`);
    return parts.join(' ');
  }) as DescFn,
};

// Pick the right entity sentinel for permission descriptions based on the
// `entity` discriminator stashed in `extra` by the contract's resolveCtx.
// Falls back to plain bold for unknown / missing entity.
const bPermissionEntity = (
  entity: string | undefined,
  title: string | undefined,
): string => {
  if (entity === 'table') return bTable(title);
  if (entity === 'field') return bField(title);
  if (entity === 'document') return bDocument(title);
  return b(title);
};

export const permissionActions = {
  set: (({ entityTitle, extra }) =>
    entityTitle
      ? `Set permission on ${bPermissionEntity(extra?.entity, entityTitle)}`
      : `Set permission`) as DescFn,
  drop: (({ entityTitle, extra }) =>
    entityTitle
      ? `Reset permission on ${bPermissionEntity(extra?.entity, entityTitle)}`
      : `Reset permission`) as DescFn,
  bulkDrop: (() => `Reset permissions`) as DescFn,
  bulkRestore: (() => `Restore permissions`) as DescFn,
};

export const rlsPolicyActions = {
  add: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Add ${bRlsPolicy(entityTitle)} RLS policy to ${bTable(
          parentEntityTitle,
        )}`
      : `Add ${bRlsPolicy(entityTitle)} RLS policy`) as DescFn,
  edit: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Edit ${bRlsPolicy(entityTitle)} RLS policy in ${bTable(
          parentEntityTitle,
        )}`
      : `Edit ${bRlsPolicy(entityTitle)} RLS policy`) as DescFn,
  rename: (({ entityTitle, parentEntityTitle, extra }) => {
    const oldTitle = extra?.oldTitle as string | undefined;
    const renamed =
      oldTitle && oldTitle !== entityTitle
        ? `Rename ${bRlsPolicy(oldTitle)} RLS policy to ${bRlsPolicy(
            entityTitle,
          )}`
        : `Rename RLS policy to ${bRlsPolicy(entityTitle)}`;
    return parentEntityTitle
      ? `${renamed} in ${bTable(parentEntityTitle)}`
      : renamed;
  }) as DescFn,
  delete: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Delete ${bRlsPolicy(entityTitle)} RLS policy from ${bTable(
          parentEntityTitle,
        )}`
      : `Delete ${bRlsPolicy(entityTitle)} RLS policy`) as DescFn,
  setSubjects: (({ entityTitle, parentEntityTitle }) => {
    const base = `Update subjects on ${bRlsPolicy(entityTitle)} RLS policy`;
    return parentEntityTitle ? `${base} in ${bTable(parentEntityTitle)}` : base;
  }) as DescFn,
  filterAdd: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Add filter on ${bRlsPolicy(parentEntityTitle)} RLS policy`
      : `Add filter on RLS policy`) as DescFn,
};
