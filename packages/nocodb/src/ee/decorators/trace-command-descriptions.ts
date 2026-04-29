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
export const bRlsPolicy = token('rlsPolicy');
export const bExtension = token('extension');
export const bViewSection = token('viewSection');
export const bRecordTemplate = token('recordTemplate');
export const bDateDependency = token('dateDependency');

import type { DescCtx, DescFn } from 'src/command-registry/_types';
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
export const fieldActions = buildActions(bField, 'field', bTable);
export const viewActions = buildActions(bView, 'view', bTable);
export const hookActions = buildActions(bHook, 'webhook', bTable);
export const dashboardActions = buildActions(bDashboard, 'dashboard');
export const widgetActions = buildActions(bWidget, 'widget', bDashboard);
export const scriptActions = buildActions(bScript, 'script');
export const workflowActions = buildActions(bWorkflow, 'workflow');
export const baseVariableActions = buildActions(bBaseVariable, 'variable');
export const syncActions = buildActions(bSync, 'sync');
export const extensionActions = buildActions(bExtension, 'extension');
export const rlsPolicyActions = buildActions(bRlsPolicy, 'RLS policy', bTable);
export const viewSectionActions = buildActions(bViewSection, 'view section');
export const recordTemplateActions = buildActions(
  bRecordTemplate,
  'record template',
);

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

/**
 * Share-view actions — no parent icon; the view is always the subject.
 */
export const shareViewActions = {
  create: (({ entityTitle }) => `Share ${bView(entityTitle)} view`) as DescFn,
  update: (({ entityTitle }) =>
    `Edit shared link of ${bView(entityTitle)} view`) as DescFn,
  delete: (({ entityTitle }) =>
    `Remove shared link of ${bView(entityTitle)} view`) as DescFn,
};

/**
 * Permission & misc entities that don't fit the standard CRUD shape.
 */
export const permissionActions = {
  set: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Set permission on ${b(entityTitle)} in ${bTable(parentEntityTitle)}`
      : `Set permission on ${b(entityTitle)}`) as DescFn,
  drop: (({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Remove permission on ${b(entityTitle)} in ${bTable(parentEntityTitle)}`
      : `Remove permission on ${b(entityTitle)}`) as DescFn,
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

export const visibilityActions = {
  update: (({ parentEntityTitle }) =>
    parentEntityTitle
      ? `Update field visibility in ${bTable(parentEntityTitle)}`
      : `Update field visibility`) as DescFn,
};

export const viewColumnActions = {
  update: (({ parentEntityTitle, extra }) => {
    const parts = ['Edit field visibility'];
    if (parentEntityTitle) parts.push(`in ${bView(parentEntityTitle)}`);
    if (extra?.tableTitle) parts.push(`in ${bTable(extra.tableTitle)}`);
    return parts.join(' ');
  }) as DescFn,
};
