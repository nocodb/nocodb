import type { ApiTokenPermissionLevel } from 'nocodb-sdk';

interface TokenPermissionMapping {
  category: string;
  level: 'read' | 'write';
}

/**
 * Maps ACL operation names to their required token permission category and level.
 *
 * Operations NOT in this map are unrestricted — if the user's role allows it,
 * the token allows it. This ensures backward compatibility and avoids blocking
 * unmapped operations (e.g., AI features, MCP, workflows, etc.)
 */
export const API_TOKEN_PERMISSION_MAP: Record<string, TokenPermissionMapping> = {
  // ──────────────────────────────────
  // Data > Records (read)
  // ──────────────────────────────────
  dataList: { category: 'records', level: 'read' },
  dataRead: { category: 'records', level: 'read' },
  dataExist: { category: 'records', level: 'read' },
  dataFindOne: { category: 'records', level: 'read' },
  dataGroupBy: { category: 'records', level: 'read' },
  dataCount: { category: 'records', level: 'read' },
  dataAggregate: { category: 'records', level: 'read' },
  bulkAggregate: { category: 'records', level: 'read' },
  bulkDataList: { category: 'records', level: 'read' },
  linkDataList: { category: 'records', level: 'read' },
  groupedDataList: { category: 'records', level: 'read' },
  mmList: { category: 'records', level: 'read' },
  hmList: { category: 'records', level: 'read' },
  nestedDataList: { category: 'records', level: 'read' },
  mmExcludedList: { category: 'records', level: 'read' },
  hmExcludedList: { category: 'records', level: 'read' },
  btExcludedList: { category: 'records', level: 'read' },
  ooExcludedList: { category: 'records', level: 'read' },
  dataExport: { category: 'records', level: 'read' },
  exportCsv: { category: 'records', level: 'read' },
  exportExcel: { category: 'records', level: 'read' },

  // Data > Records (write)
  dataInsert: { category: 'records', level: 'write' },
  dataUpdate: { category: 'records', level: 'write' },
  dataDelete: { category: 'records', level: 'write' },
  bulkDataInsert: { category: 'records', level: 'write' },
  bulkDataUpdate: { category: 'records', level: 'write' },
  bulkDataUpdateAll: { category: 'records', level: 'write' },
  bulkDataDelete: { category: 'records', level: 'write' },
  bulkDataDeleteAll: { category: 'records', level: 'write' },
  bulkDataUpsert: { category: 'records', level: 'write' },
  relationDataAdd: { category: 'records', level: 'write' },
  relationDataRemove: { category: 'records', level: 'write' },
  nestedDataLink: { category: 'records', level: 'write' },
  nestedDataUnlink: { category: 'records', level: 'write' },
  nestedDataListCopyPasteOrDeleteAll: { category: 'records', level: 'write' },

  // ──────────────────────────────────
  // Data > Comments (read)
  // ──────────────────────────────────
  commentList: { category: 'comments', level: 'read' },
  commentCount: { category: 'comments', level: 'read' },

  // Data > Comments (write)
  commentRow: { category: 'comments', level: 'write' },
  commentUpdate: { category: 'comments', level: 'write' },
  commentDelete: { category: 'comments', level: 'write' },

  // ──────────────────────────────────
  // Schema > Tables (read)
  // ──────────────────────────────────
  tableList: { category: 'tables', level: 'read' },
  tableGet: { category: 'tables', level: 'read' },

  // Schema > Tables (write)
  tableCreate: { category: 'tables', level: 'write' },
  tableUpdate: { category: 'tables', level: 'write' },
  tableDelete: { category: 'tables', level: 'write' },

  // ──────────────────────────────────
  // Schema > Fields (read)
  // ──────────────────────────────────
  columnList: { category: 'fields', level: 'read' },
  relationList: { category: 'fields', level: 'read' },
  relationListAll: { category: 'fields', level: 'read' },
  indexList: { category: 'fields', level: 'read' },

  // Schema > Fields (write)
  columnAdd: { category: 'fields', level: 'write' },
  columnUpdate: { category: 'fields', level: 'write' },
  columnDelete: { category: 'fields', level: 'write' },
  duplicateColumn: { category: 'fields', level: 'write' },

  // ──────────────────────────────────
  // Schema > Views (read)
  // ──────────────────────────────────
  viewList: { category: 'views', level: 'read' },
  viewColumnList: { category: 'views', level: 'read' },
  formViewGet: { category: 'views', level: 'read' },
  galleryViewGet: { category: 'views', level: 'read' },
  kanbanViewGet: { category: 'views', level: 'read' },
  calendarViewGet: { category: 'views', level: 'read' },
  sortList: { category: 'views', level: 'read' },
  filterList: { category: 'views', level: 'read' },
  filterGet: { category: 'views', level: 'read' },
  filterChildrenList: { category: 'views', level: 'read' },

  // Schema > Views (write)
  viewCreate: { category: 'views', level: 'write' },
  viewUpdate: { category: 'views', level: 'write' },
  viewDelete: { category: 'views', level: 'write' },
  gridViewCreate: { category: 'views', level: 'write' },
  formViewCreate: { category: 'views', level: 'write' },
  galleryViewCreate: { category: 'views', level: 'write' },
  kanbanViewCreate: { category: 'views', level: 'write' },
  mapViewCreate: { category: 'views', level: 'write' },
  calendarViewCreate: { category: 'views', level: 'write' },
  gridViewUpdate: { category: 'views', level: 'write' },
  formViewUpdate: { category: 'views', level: 'write' },
  formColumnUpdate: { category: 'views', level: 'write' },
  galleryViewUpdate: { category: 'views', level: 'write' },
  kanbanViewUpdate: { category: 'views', level: 'write' },
  mapViewUpdate: { category: 'views', level: 'write' },
  calendarViewUpdate: { category: 'views', level: 'write' },
  viewColumnUpdate: { category: 'views', level: 'write' },
  gridColumnUpdate: { category: 'views', level: 'write' },
  sortCreate: { category: 'views', level: 'write' },
  sortUpdate: { category: 'views', level: 'write' },
  sortDelete: { category: 'views', level: 'write' },
  filterCreate: { category: 'views', level: 'write' },
  filterUpdate: { category: 'views', level: 'write' },
  filterDelete: { category: 'views', level: 'write' },
  hideAllColumns: { category: 'views', level: 'write' },
  showAllColumns: { category: 'views', level: 'write' },
  shareView: { category: 'views', level: 'write' },
  shareViewUpdate: { category: 'views', level: 'write' },

  // ──────────────────────────────────
  // Tools > Webhooks (read)
  // ──────────────────────────────────
  hookList: { category: 'webhooks', level: 'read' },
  hookLogList: { category: 'webhooks', level: 'read' },

  // Tools > Webhooks (write)
  hookCreate: { category: 'webhooks', level: 'write' },
  hookUpdate: { category: 'webhooks', level: 'write' },
  hookDelete: { category: 'webhooks', level: 'write' },
  hookTest: { category: 'webhooks', level: 'write' },
  hookTrigger: { category: 'webhooks', level: 'write' },

  // ──────────────────────────────────
  // Tools > Extensions (read)
  // ──────────────────────────────────
  extensionList: { category: 'extensions', level: 'read' },
  extensionRead: { category: 'extensions', level: 'read' },

  // Tools > Extensions (write)
  extensionCreate: { category: 'extensions', level: 'write' },
  extensionUpdate: { category: 'extensions', level: 'write' },
  extensionDelete: { category: 'extensions', level: 'write' },

  // ──────────────────────────────────
  // Admin > Base (read)
  // ──────────────────────────────────
  baseGet: { category: 'base', level: 'read' },
  baseInfoGet: { category: 'base', level: 'read' },
  baseCost: { category: 'base', level: 'read' },
  swaggerJson: { category: 'base', level: 'read' },
  baseUserList: { category: 'base', level: 'read' },
  recordAuditList: { category: 'base', level: 'read' },
  jobList: { category: 'base', level: 'read' },

  // Admin > Base (write)
  sourceCreate: { category: 'base', level: 'write' },
  baseDelete: { category: 'base', level: 'write' },
  userInvite: { category: 'base', level: 'write' },
  baseUserMetaUpdate: { category: 'base', level: 'write' },

  // ──────────────────────────────────
  // Workspace-scoped permissions
  // ──────────────────────────────────
  // Resources > Bases (read)
  workspaceBaseList: { category: 'bases', level: 'read' },
  baseList: { category: 'bases', level: 'read' },

  // Resources > Bases (write)
  createBase: { category: 'bases', level: 'write' },

  // Resources > Integrations (read)
  integrationList: { category: 'integrations', level: 'read' },
  integrationGet: { category: 'integrations', level: 'read' },

  // Resources > Integrations (write)
  integrationCreate: { category: 'integrations', level: 'write' },
  integrationUpdate: { category: 'integrations', level: 'write' },
  integrationDelete: { category: 'integrations', level: 'write' },

  // Members > Users (read)
  workspaceUserList: { category: 'users', level: 'read' },

  // Members > Users (write)
  workspaceInvite: { category: 'users', level: 'write' },
  workspaceUserUpdate: { category: 'users', level: 'write' },
  workspaceUserDelete: { category: 'users', level: 'write' },
};

/**
 * Check if a token's permission level is sufficient for the required level.
 * 'write' >= 'read' >= 'none'
 */
export function isTokenPermissionSufficient(
  tokenLevel: 'none' | 'read' | 'write',
  requiredLevel: 'read' | 'write',
): boolean {
  if (tokenLevel === 'write') return true;
  if (tokenLevel === 'read') return requiredLevel === 'read';
  return false; // 'none'
}

/**
 * Get the token permission requirement for a given ACL operation.
 * Returns undefined if the operation is not mapped (unrestricted).
 */
export function getTokenPermissionForOperation(
  opName: string,
): TokenPermissionMapping | undefined {
  return API_TOKEN_PERMISSION_MAP[opName];
}

/**
 * Check if the token's permissions allow the given operation.
 * Returns true if:
 * - Token has no permissions (legacy token, full access)
 * - Operation is not in the permission map (unrestricted)
 * - Token's category level meets the required level
 */
export function checkTokenPermission(
  tokenPermissions: Record<string, ApiTokenPermissionLevel> | null | undefined,
  opName: string,
): boolean {
  // Legacy token or no permissions = full access
  if (!tokenPermissions) return true;

  const mapping = API_TOKEN_PERMISSION_MAP[opName];

  // Operation not mapped = unrestricted
  if (!mapping) return true;

  const tokenLevel = tokenPermissions[mapping.category] || 'none';
  return isTokenPermissionSufficient(
    tokenLevel as 'none' | 'read' | 'write',
    mapping.level,
  );
}
