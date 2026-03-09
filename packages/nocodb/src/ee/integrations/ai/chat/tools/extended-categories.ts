/**
 * Static map of extended tool category names → descriptions.
 * Extracted to its own file to avoid circular dependency between
 * chat-tool-registry.ts and load-tools.tool.ts.
 */
export const EXTENDED_CATEGORIES: Record<string, string> = {
  view:
    'View configuration tools — filters, sorts, group-by, field visibility. ' +
    'Load when the user wants to customize how a view displays data.',
  dashboard:
    'Dashboard & widget tools — create/manage dashboards, charts, metrics, text widgets. ' +
    'Load when the user wants to build or modify dashboards and visualizations.',
};
