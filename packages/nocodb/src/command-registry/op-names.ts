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
  tableReorder: 'tableReorder',
  tableV3Create: 'tableV3Create',

  // Columns
  columnAdd: 'columnAdd',
  columnUpdate: 'columnUpdate',
  columnDelete: 'columnDelete',
  columnSetAsPrimary: 'columnSetAsPrimary',
  columnsBulk: 'columnsBulk',
  /** Inverse of a SingleLineText→link conversion: drop the link, recreate
   *  the text column (original id) and restore its backed-up data. */
  columnRevertLinkToText: 'columnRevertLinkToText',
  /** Inverse of a link→SingleLineText conversion: drop the text column,
   *  recreate the link (original id) and re-link rows from the joined text. */
  columnRevertTextToLink: 'columnRevertTextToLink',

  // Views (generic)
  viewUpdate: 'viewUpdate',
  viewDelete: 'viewDelete',

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
  listViewCreate: 'listViewCreate',
  listViewUpdate: 'listViewUpdate',
  timelineViewCreate: 'timelineViewCreate',
  timelineViewUpdate: 'timelineViewUpdate',
  ganttViewCreate: 'ganttViewCreate',
  ganttViewUpdate: 'ganttViewUpdate',
  mapViewCreate: 'mapViewCreate',
  mapViewUpdate: 'mapViewUpdate',

  // View columns + visibility
  viewColumnUpdate: 'viewColumnUpdate',
  gridColumnUpdate: 'gridColumnUpdate',
  formColumnUpdate: 'formColumnUpdate',
  timelineColumnUpdate: 'timelineColumnUpdate',
  ganttColumnUpdate: 'ganttColumnUpdate',
  listColumnUpdate: 'listColumnUpdate',
  showAllColumns: 'showAllColumns',
  hideAllColumns: 'hideAllColumns',

  // Sorts
  sortCreate: 'sortCreate',
  sortUpdate: 'sortUpdate',
  sortDelete: 'sortDelete',

  // Filters
  filterCreate: 'filterCreate',
  filterUpdate: 'filterUpdate',
  filterDelete: 'filterDelete',
  filterBulkLogicalOpUpdate: 'filterBulkLogicalOpUpdate',
  filterCreateV3: 'filterCreateV3',
  filterReplaceV3: 'filterReplaceV3',
  filterDeleteAllV3: 'filterDeleteAllV3',
  linkFilterCreate: 'linkFilterCreate',
  widgetFilterCreate: 'widgetFilterCreate',
  buttonFilterCreate: 'buttonFilterCreate',
  rowColorConditionsCreate: 'rowColorConditionsCreate',
  rowColorConditionAdd: 'rowColorConditionAdd',
  rowColorConditionUpdate: 'rowColorConditionUpdate',
  rowColorConditionDelete: 'rowColorConditionDelete',
  rowColorSelectSet: 'rowColorSelectSet',
  rowColoringRemove: 'rowColoringRemove',
  rowColoringRestore: 'rowColoringRestore',
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
  scriptDuplicate: 'scriptDuplicate',

  // Workflows
  workflowCreate: 'workflowCreate',
  workflowUpdate: 'workflowUpdate',
  workflowDelete: 'workflowDelete',
  workflowPublish: 'workflowPublish',
  workflowDuplicate: 'workflowDuplicate',

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

  // Date dependency
  dateDependencyUpdate: 'dateDependencyUpdate',
  dateDependencyDelete: 'dateDependencyDelete',

  // Base variables
  baseVariableCreate: 'baseVariableCreate',
  baseVariableUpdate: 'baseVariableUpdate',
  baseVariableDelete: 'baseVariableDelete',

  // Permissions (table / field / document)
  permissionSet: 'permissionSet',
  permissionDrop: 'permissionDrop',
  permissionBulkDrop: 'permissionBulkDrop',
  permissionBulkRestore: 'permissionBulkRestore',

  // Row-level security
  rlsPolicyCreate: 'rlsPolicyCreate',
  rlsPolicyUpdate: 'rlsPolicyUpdate',
  rlsPolicyDelete: 'rlsPolicyDelete',
  rlsPolicySetSubjects: 'rlsPolicySetSubjects',
  rlsPolicyFilterCreate: 'rlsPolicyFilterCreate',

  // Undo redo primitives
  trashRestore: 'trashRestore',
  listViewLevelsRestore: 'listViewLevelsRestore',
  viewColumnsBulkSetVisibility: 'viewColumnsBulkSetVisibility',
  macroUndo: 'macroUndo',

  // Records (data ops) — `sandbox: false` contracts; per-tab undo/redo only
  recordInsert: 'recordInsert',
  recordInsertUndo: 'recordInsertUndo',
  recordBulkInsert: 'recordBulkInsert',
  recordBulkInsertUndo: 'recordBulkInsertUndo',
  recordDelete: 'recordDelete',
  recordDeleteUndo: 'recordDeleteUndo',
  recordBulkDelete: 'recordBulkDelete',
  recordBulkDeleteUndo: 'recordBulkDeleteUndo',
  recordUpdate: 'recordUpdate',
  recordUpdateUndo: 'recordUpdateUndo',
  recordBulkUpdate: 'recordBulkUpdate',
  recordBulkUpdateUndo: 'recordBulkUpdateUndo',

  // Explicit link mutations (each is the other's inverse) + row reorder
  recordLinkAdd: 'recordLinkAdd',
  recordLinkRemove: 'recordLinkRemove',
  recordMove: 'recordMove',

  // Compound link diff/swap ops (Phase D — single op, link↔unlink swap inverse)
  recordLinkSwap: 'recordLinkSwap',
  recordLinkSwapBulk: 'recordLinkSwapBulk',
  recordLinkByDisplay: 'recordLinkByDisplay',

  // Bulk upsert — per-row update/insert outcome captured in `upsertChanges`.
  recordBulkUpsert: 'recordBulkUpsert',
  recordBulkUpsertUndo: 'recordBulkUpsertUndo',

  // SmartText cell content — PM/Markdown payload written via the internal API
  smartTextUpdateContent: 'smartTextUpdateContent',
} as const;

export type OperationName = (typeof OperationName)[keyof typeof OperationName];
