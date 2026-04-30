/**
 * Canonical names of every traced operation. Defined in CE so the
 * `@TraceCommand` decorator can be applied directly on CE service methods
 * without requiring EE-side overrides whose only purpose is to add tracing.
 *
 * Contract definitions (EE) use these values as their `name` field, and
 * service decorators pass them to `@TraceCommand(...)`. The contract is
 * resolved by name at invocation time via `OperationRegistry.contract(name)`.
 *
 * When adding a new traced operation, add the name here first.
 */
export const OperationName = {
  // Tables
  tableCreate: 'tableCreate',
  tableUpdate: 'tableUpdate',
  tableDelete: 'tableDelete',

  // Columns
  columnAdd: 'columnAdd',
  columnUpdate: 'columnUpdate',
  columnDelete: 'columnDelete',

  // Views (generic)
  viewUpdate: 'viewUpdate',
  viewDelete: 'viewDelete',
  shareView: 'shareView',
  shareViewUpdate: 'shareViewUpdate',
  shareViewDelete: 'shareViewDelete',

  // Per-type view ops
  gridViewCreate: 'gridViewCreate',
  gridViewUpdate: 'gridViewUpdate',
  formViewCreate: 'formViewCreate',
  formViewUpdate: 'formViewUpdate',
  galleryViewCreate: 'galleryViewCreate',
  galleryViewUpdate: 'galleryViewUpdate',
  kanbanViewCreate: 'kanbanViewCreate',
  kanbanViewUpdate: 'kanbanViewUpdate',
  calendarViewCreate: 'calendarViewCreate',
  calendarViewUpdate: 'calendarViewUpdate',

  // View columns + visibility
  viewColumnUpdate: 'viewColumnUpdate',
  visibilityUpdate: 'visibilityUpdate',

  // Sorts
  sortCreate: 'sortCreate',
  sortUpdate: 'sortUpdate',
  sortDelete: 'sortDelete',

  // Filters
  filterCreate: 'filterCreate',
  filterUpdate: 'filterUpdate',
  filterDelete: 'filterDelete',
  filterCreateV3: 'filterCreateV3',
  linkFilterCreate: 'linkFilterCreate',
  widgetFilterCreate: 'widgetFilterCreate',
  rlsPolicyFilterCreate: 'rlsPolicyFilterCreate',
  rowColorConditionsCreate: 'rowColorConditionsCreate',

  // Hooks
  hookCreate: 'hookCreate',
  hookUpdate: 'hookUpdate',
  hookDelete: 'hookDelete',

  // Extensions
  extensionCreate: 'extensionCreate',
  extensionUpdate: 'extensionUpdate',
  extensionDelete: 'extensionDelete',

  // Dashboards + widgets
  dashboardCreate: 'dashboardCreate',
  dashboardUpdate: 'dashboardUpdate',
  dashboardDelete: 'dashboardDelete',
  widgetCreate: 'widgetCreate',
  widgetUpdate: 'widgetUpdate',
  widgetDelete: 'widgetDelete',
  duplicateWidget: 'duplicateWidget',

  // Scripts
  scriptCreate: 'scriptCreate',
  scriptUpdate: 'scriptUpdate',
  scriptDelete: 'scriptDelete',

  // Workflows
  workflowCreate: 'workflowCreate',
  workflowUpdate: 'workflowUpdate',
  workflowDelete: 'workflowDelete',
  workflowPublish: 'workflowPublish',

  // View sections
  viewSectionCreate: 'viewSectionCreate',
  viewSectionUpdate: 'viewSectionUpdate',
  viewSectionDelete: 'viewSectionDelete',

  // Record templates
  recordTemplateCreate: 'recordTemplateCreate',
  recordTemplateUpdate: 'recordTemplateUpdate',
  recordTemplateDelete: 'recordTemplateDelete',

  // Sync
  syncCreate: 'syncCreate',
  syncUpdate: 'syncUpdate',
  syncDelete: 'syncDelete',

  // Permissions
  permissionSet: 'permissionSet',
  permissionDrop: 'permissionDrop',

  // RLS
  rlsPolicyCreate: 'rlsPolicyCreate',
  rlsPolicyUpdate: 'rlsPolicyUpdate',
  rlsPolicyDelete: 'rlsPolicyDelete',

  // Date dependency
  dateDependencyUpdate: 'dateDependencyUpdate',
  dateDependencyDelete: 'dateDependencyDelete',

  // Base variables
  baseVariableCreate: 'baseVariableCreate',
  baseVariableUpdate: 'baseVariableUpdate',
  baseVariableDelete: 'baseVariableDelete',
} as const;

export type OperationName = (typeof OperationName)[keyof typeof OperationName];
