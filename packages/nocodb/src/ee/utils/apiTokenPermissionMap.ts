import type { ApiTokenPermissionLevel } from 'nocodb-sdk';

interface TokenPermissionMapping {
  category: string;
  level: 'read' | 'write';
}

/**
 * Maps ACL operation names to their required token permission category and level.
 *
 * Simplified Airtable-style categories:
 *   data     — records, tables, fields, views, extensions, base settings
 *   comments — row comments
 *   webhooks — webhook management
 *   users    — user/collaborator management
 *
 * Operations NOT in this map are unrestricted — if the user's role allows it,
 * the token allows it. This ensures backward compatibility and avoids blocking
 * unmapped operations (e.g., AI features, MCP, workflows, etc.)
 */
export const API_TOKEN_PERMISSION_MAP: Record<string, TokenPermissionMapping> = {
  // ──────────────────────────────────
  // Data — Records (read)
  // ──────────────────────────────────
  dataList: { category: 'data', level: 'read' },
  dataRead: { category: 'data', level: 'read' },
  dataExist: { category: 'data', level: 'read' },
  dataFindOne: { category: 'data', level: 'read' },
  dataGroupBy: { category: 'data', level: 'read' },
  dataCount: { category: 'data', level: 'read' },
  dataAggregate: { category: 'data', level: 'read' },
  bulkAggregate: { category: 'data', level: 'read' },
  bulkDataList: { category: 'data', level: 'read' },
  linkDataList: { category: 'data', level: 'read' },
  groupedDataList: { category: 'data', level: 'read' },
  mmList: { category: 'data', level: 'read' },
  hmList: { category: 'data', level: 'read' },
  nestedDataList: { category: 'data', level: 'read' },
  mmExcludedList: { category: 'data', level: 'read' },
  hmExcludedList: { category: 'data', level: 'read' },
  btExcludedList: { category: 'data', level: 'read' },
  ooExcludedList: { category: 'data', level: 'read' },
  dataExport: { category: 'data', level: 'read' },
  exportCsv: { category: 'data', level: 'read' },
  exportExcel: { category: 'data', level: 'read' },

  // Data — Records (write)
  dataInsert: { category: 'data', level: 'write' },
  dataUpdate: { category: 'data', level: 'write' },
  dataDelete: { category: 'data', level: 'write' },
  bulkDataInsert: { category: 'data', level: 'write' },
  bulkDataUpdate: { category: 'data', level: 'write' },
  bulkDataUpdateAll: { category: 'data', level: 'write' },
  bulkDataDelete: { category: 'data', level: 'write' },
  bulkDataDeleteAll: { category: 'data', level: 'write' },
  bulkDataUpsert: { category: 'data', level: 'write' },
  relationDataAdd: { category: 'data', level: 'write' },
  relationDataRemove: { category: 'data', level: 'write' },
  nestedDataLink: { category: 'data', level: 'write' },
  nestedDataUnlink: { category: 'data', level: 'write' },
  nestedDataListCopyPasteOrDeleteAll: { category: 'data', level: 'write' },

  // Data — Tables (read)
  tableList: { category: 'data', level: 'read' },
  tableGet: { category: 'data', level: 'read' },

  // Data — Tables (write)
  tableCreate: { category: 'data', level: 'write' },
  tableUpdate: { category: 'data', level: 'write' },
  tableDelete: { category: 'data', level: 'write' },

  // Data — Fields (read)
  columnList: { category: 'data', level: 'read' },
  relationList: { category: 'data', level: 'read' },
  relationListAll: { category: 'data', level: 'read' },
  indexList: { category: 'data', level: 'read' },

  // Data — Fields (write)
  columnAdd: { category: 'data', level: 'write' },
  columnUpdate: { category: 'data', level: 'write' },
  columnDelete: { category: 'data', level: 'write' },
  duplicateColumn: { category: 'data', level: 'write' },

  // Data — Views (read)
  viewList: { category: 'data', level: 'read' },
  viewColumnList: { category: 'data', level: 'read' },
  formViewGet: { category: 'data', level: 'read' },
  galleryViewGet: { category: 'data', level: 'read' },
  kanbanViewGet: { category: 'data', level: 'read' },
  calendarViewGet: { category: 'data', level: 'read' },
  sortList: { category: 'data', level: 'read' },
  filterList: { category: 'data', level: 'read' },
  filterGet: { category: 'data', level: 'read' },
  filterChildrenList: { category: 'data', level: 'read' },

  // Data — Views (write)
  viewCreate: { category: 'data', level: 'write' },
  viewUpdate: { category: 'data', level: 'write' },
  viewDelete: { category: 'data', level: 'write' },
  gridViewCreate: { category: 'data', level: 'write' },
  formViewCreate: { category: 'data', level: 'write' },
  galleryViewCreate: { category: 'data', level: 'write' },
  kanbanViewCreate: { category: 'data', level: 'write' },
  mapViewCreate: { category: 'data', level: 'write' },
  calendarViewCreate: { category: 'data', level: 'write' },
  gridViewUpdate: { category: 'data', level: 'write' },
  formViewUpdate: { category: 'data', level: 'write' },
  formColumnUpdate: { category: 'data', level: 'write' },
  galleryViewUpdate: { category: 'data', level: 'write' },
  kanbanViewUpdate: { category: 'data', level: 'write' },
  mapViewUpdate: { category: 'data', level: 'write' },
  calendarViewUpdate: { category: 'data', level: 'write' },
  viewColumnUpdate: { category: 'data', level: 'write' },
  gridColumnUpdate: { category: 'data', level: 'write' },
  sortCreate: { category: 'data', level: 'write' },
  sortUpdate: { category: 'data', level: 'write' },
  sortDelete: { category: 'data', level: 'write' },
  filterCreate: { category: 'data', level: 'write' },
  filterUpdate: { category: 'data', level: 'write' },
  filterDelete: { category: 'data', level: 'write' },
  hideAllColumns: { category: 'data', level: 'write' },
  showAllColumns: { category: 'data', level: 'write' },
  shareView: { category: 'data', level: 'write' },
  shareViewUpdate: { category: 'data', level: 'write' },

  // Data — Extensions (read)
  extensionList: { category: 'data', level: 'read' },
  extensionRead: { category: 'data', level: 'read' },

  // Data — Extensions (write)
  extensionCreate: { category: 'data', level: 'write' },
  extensionUpdate: { category: 'data', level: 'write' },
  extensionDelete: { category: 'data', level: 'write' },

  // Data — Base settings (read)
  baseGet: { category: 'data', level: 'read' },
  baseInfoGet: { category: 'data', level: 'read' },
  baseCost: { category: 'data', level: 'read' },
  swaggerJson: { category: 'data', level: 'read' },
  recordAuditList: { category: 'data', level: 'read' },
  jobList: { category: 'data', level: 'read' },

  // Data — Base settings (write)
  sourceCreate: { category: 'data', level: 'write' },
  baseDelete: { category: 'data', level: 'write' },

  // ──────────────────────────────────
  // Comments (read)
  // ──────────────────────────────────
  commentList: { category: 'comments', level: 'read' },
  commentCount: { category: 'comments', level: 'read' },

  // Comments (write)
  commentRow: { category: 'comments', level: 'write' },
  commentUpdate: { category: 'comments', level: 'write' },
  commentDelete: { category: 'comments', level: 'write' },

  // ──────────────────────────────────
  // Webhooks (read)
  // ──────────────────────────────────
  hookList: { category: 'webhooks', level: 'read' },
  hookLogList: { category: 'webhooks', level: 'read' },

  // Webhooks (write)
  hookCreate: { category: 'webhooks', level: 'write' },
  hookUpdate: { category: 'webhooks', level: 'write' },
  hookDelete: { category: 'webhooks', level: 'write' },
  hookTest: { category: 'webhooks', level: 'write' },
  hookTrigger: { category: 'webhooks', level: 'write' },

  // ──────────────────────────────────
  // Users (read)
  // ──────────────────────────────────
  baseUserList: { category: 'users', level: 'read' },
  workspaceUserList: { category: 'users', level: 'read' },

  // Users (write)
  userInvite: { category: 'users', level: 'write' },
  baseUserMetaUpdate: { category: 'users', level: 'write' },
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
