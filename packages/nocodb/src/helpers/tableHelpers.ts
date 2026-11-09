import {
  type ColumnType,
  extractRolesObj,
  getStandingRole,
  isServiceUser,
  NcAccessSource,
  type NcContext,
  type OperationSource,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  personalAgentRole,
  ProjectRoles,
} from 'nocodb-sdk';
import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { AgentRoleCap, NcRequest, UserType } from 'nocodb-sdk';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  RollupColumn,
} from '~/models';
import { Model, ModelRoleVisibility, Permission, User, View } from '~/models';
import {
  deleteColumnSystemPropsFromRequest,
  TableSystemColumns,
} from '~/helpers/columnHelpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import { DriverClient } from '~/utils/nc-config';
import { isEE } from '~/utils';
import { isSharedViewAccess } from '~/helpers/accessSource';

export const repopulateCreateTableSystemColumns = (
  _context: NcContext,
  {
    columns,
    clientType,
    isMeta = true,
    operationSource,
  }: {
    columns: (ColumnType & { cn?: string })[];
    clientType: DriverClient;
    isMeta?: boolean;
    operationSource?: OperationSource;
  },
) => {
  const tableSystemColumns = TableSystemColumns(
    isEE && clientType === DriverClient.PG,
    isMeta,
  );

  // check meta column support and filter out

  const strictOneColumnUidt = tableSystemColumns
    .filter((col) => !col.allowNonSystem)
    .map((col) => col.uidt);

  const result = [
    ...tableSystemColumns.map((col) => {
      delete col.allowNonSystem;
      (col as any).cn = col.column_name;
      return col as ColumnType & { cn?: string };
    }),
    // remove all UIDT ID and Order from request
    ...columns.filter(
      (col) => !strictOneColumnUidt.includes(col.uidt as UITypes),
    ),
  ];
  for (let i = result.length - 1; i >= tableSystemColumns.length; i--) {
    const col = result[i];
    // check if title, column name or uidt is intersecting with system columns
    const intersectingSystemCols = tableSystemColumns.filter(
      (sysCol) =>
        sysCol.title === col.title || sysCol.column_name === col.column_name,
    );
    for (const sysCol of intersectingSystemCols) {
      if (
        sysCol.uidt === col.uidt &&
        // Match by column_name, or when column_name is absent,
        // or fall back to title match as a last resort
        (sysCol.column_name === col.column_name ||
          col.column_name === undefined ||
          (sysCol.title === col.title && col.title !== undefined))
      ) {
        // identic with system cols, so we remove it
        result.splice(i, 1);
        continue;
      }
      if (col.title && col.title === sysCol.title) {
        col.title = getUniqueColumnAliasName(result as any[], col.title);
      }
      if (col.column_name && col.column_name === sysCol.column_name) {
        col.column_name = getUniqueColumnName(result as any[], col.column_name);
        col.cn = col.column_name;
      }
    }
    deleteColumnSystemPropsFromRequest(col, { operationSource });
  }
  return result;
};

/**
 * Check if a table has default table visibility (Everyone)
 * Returns true if no TABLE_VISIBILITY permission exists (defaults to Everyone)
 * When "Everyone" is selected in UI, the permission record is deleted,
 * so no permission = Everyone = default visibility
 */
export function hasDefaultTableVisibility(
  tableId: string,
  permissions: Permission[],
): boolean {
  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // If no permission exists, it defaults to Everyone (default visibility)
  // When "Everyone" is selected in UI, the permission is deleted
  return !visibilityPermission;
}

/**
 * Check if a table has "Viewers & up" table visibility
 * Returns true if the TABLE_VISIBILITY permission is set to "Viewers & up"
 * (granted_type: 'role', granted_role: 'viewer')
 */
export function hasViewersAndUpTableVisibility(
  tableId: string,
  permissions: Permission[],
): boolean {
  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // Check if permission is "Viewers & up" (granted_type: 'role', granted_role: 'viewer')
  if (visibilityPermission) {
    return (
      visibilityPermission.granted_type === PermissionGrantedType.ROLE &&
      visibilityPermission.granted_role === PermissionRole.VIEWER
    );
  }

  return false;
}

/**
 * Check if user has access to a table based on TABLE_VISIBILITY permission
 * Base owners always have access
 */
export async function hasTableVisibilityAccess(
  context: NcContext,
  tableId: string,
  user: NcRequest['user'],
  permissions?: Permission[],
): Promise<boolean> {
  // Get permissions if not provided
  if (!permissions) {
    if (!context.permissions)
      context.permissions = await Permission.list(context, context.base_id);
    permissions = context.permissions;
  }

  // if user not defined then check if table have default visibility for all users
  if (!user) {
    return hasDefaultTableVisibility(tableId, context.permissions);
  }

  // Base owners always have access
  // Check base_roles (can be string or object)
  const baseRoles = extractRolesObj((user as any)?.base_roles);
  if (baseRoles?.[ProjectRoles.OWNER]) {
    return true;
  }

  // Also check roles object for backward compatibility
  const roles = extractRolesObj((user as any)?.roles);
  if (roles?.[ProjectRoles.OWNER]) {
    return true;
  }

  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // If no permission exists, default to everyone (accessible)
  if (!visibilityPermission) {
    return true;
  }

  // Real standing, not an app runner's capability floor.
  const userRole = getStandingRole(user);

  // If no role found, user doesn't have access
  if (!userRole) {
    return false;
  }

  // Check if user has permission
  return await Permission.isAllowed(context, visibilityPermission, {
    id: user.id,
    role: userRole,
    is_agent: user?.is_agent,
  });
}

/**
 * Whether the caller's role still reaches a table under the CE per-view
 * visibility rules (`ModelRoleVisibility`, the "UI ACL" screen).
 *
 * `getAccessibleTables` drops a table from the LIST once every one of its views
 * is disabled for the role, but the routes that take a table or view id
 * directly never re-applied that decision — so an id learned while access was
 * legitimate (or read off a Link column's `fk_related_model_id`) kept working.
 * Same rule as the list: reachable while ANY view is still enabled for ANY role
 * the caller holds — except a model with no views at all, which the list drops
 * but this grants. That divergence is deliberately fail-open: a viewless model
 * is mid-create or partially deleted, not an access decision to enforce.
 */
export async function hasModelRoleVisibilityAccess(
  context: NcContext,
  tableId: string,
  roles: Record<string, boolean>,
): Promise<boolean> {
  if (roles?.[ProjectRoles.OWNER]) return true;

  // Cheapest gate first — most bases have no UI-ACL rows at all, and this list
  // is cached, so the common request never loads the model or its views.
  const disabledRolesByView = new Map<string, Set<string>>();
  for (const entry of await ModelRoleVisibility.list(
    context,
    context.base_id,
  )) {
    if (!entry.disabled) continue;
    const disabled = disabledRolesByView.get(entry.fk_view_id) ?? new Set();
    disabled.add(entry.role);
    disabledRolesByView.set(entry.fk_view_id, disabled);
  }
  if (!disabledRolesByView.size) return true;

  const callerRoles = Object.values(ProjectRoles).filter(
    (role) => roles?.[role],
  );
  // No ProjectRole in the caller's set — fail open, consistent with every other
  // unknown here (`!model`, `!views.length`). The set can legitimately lack one
  // (a non-`base` scope that still resolves a table id, or access granted purely
  // via `extendedScope`), and UI-ACL is keyed on ProjectRoles, so it has nothing
  // to say about such a caller. The main ACL gate already ran.
  if (!callerRoles.length) return true;

  const model = await Model.get(context, tableId);
  // Unknown table — leave the 404 to the route rather than masking it as a 403.
  if (!model) return true;

  // Only view ids are needed, and this runs in extract-ids on every request
  // that resolves a table or view id — so use the cheap cached id list, not
  // `model.getViews` (a per-view `getViewWithInfo`, i.e. N fetches per request).
  const views = await View.list(context, tableId);
  if (!views.length) return true;

  return views.some((view) => {
    const disabled = disabledRolesByView.get(view.id);
    return callerRoles.some((role) => !disabled?.has(role));
  });
}

/** Both table-visibility rules: the TABLE_VISIBILITY permission and UI ACL. */
export async function isTableVisible(
  context: NcContext,
  tableId: string,
  user: (UserType & { base_roles?: Record<string, boolean> }) | undefined,
): Promise<boolean> {
  return (
    (await hasTableVisibilityAccess(context, tableId, user)) &&
    (await hasModelRoleVisibilityAccess(
      context,
      tableId,
      extractRolesObj(user?.base_roles),
    ))
  );
}

/**
 * Whether a nested-link fetch must collapse the RELATED table to what the link
 * exposes (pk + primary value + the link's custom display column). Two
 * independent access boundaries: the related table is not visible to the
 * caller (`isTableVisible`), or the request came through a shared VIEW/form — which
 * publishes one view of one table, so the tables it links to are not published.
 *
 * The second needs its own check: with no user `hasTableVisibilityAccess` falls
 * back to `hasDefaultTableVisibility`, `true` whenever no TABLE_VISIBILITY row
 * exists, so a same-base link on a shared view used to expose the full table.
 * Shared BASE is excluded — authenticated pseudo-user, normal access.
 */
export async function hasLimitedRelatedTableAccess(
  context: NcContext,
  relatedTableId: string,
): Promise<boolean> {
  if (isSharedViewAccess(context)) return true;

  return !(await isTableVisible(context, relatedTableId, context.user));
}

/**
 * Whether a read through a link must collapse the related table to pk +
 * display value: the caller lacks access to it under its role in the related
 * table's base, or comes through a shared view, or through a shared base that
 * the related table's base is not part of.
 */
export async function hasLimitedLinkTargetAccess(
  context: NcContext,
  colOptions: LinkToAnotherRecordColumn,
  relatedModelId: string,
): Promise<boolean> {
  if (
    context.access_source === NcAccessSource.SHARED_BASE &&
    colOptions.isCrossBaseLink()
  ) {
    return true;
  }
  const { refContext } = colOptions.getRelContext();
  if (isSharedViewAccess(refContext)) return true;
  return isTargetHiddenIn(refContext, colOptions, relatedModelId, {
    noRoleHides: true,
  });
}

/**
 * `rolesFromOtherBase`: the context's user carries roles of another base.
 * `noRoleHides`: no role (or no-access) in the related base hides the table
 * even when no visibility rule applies to it.
 */
async function isTargetHiddenIn(
  refContext: NcContext,
  colOptions: LinkToAnotherRecordColumn,
  relatedModelId: string,
  { rolesFromOtherBase = false, noRoleHides = false } = {},
): Promise<boolean> {
  if (!colOptions.isCrossBaseLink() && !rolesFromOtherBase) {
    return !(await isTableVisible(refContext, relatedModelId, refContext.user));
  }
  const relatedUser = await userInRelatedBase(refContext);
  // A user re-resolved in the related base with no role (or no-access) there
  // must not fall through to the "no visibility rule = open" default.
  if (relatedUser !== refContext.user) {
    const role = getStandingRole(relatedUser);
    if (!role || role === ProjectRoles.NO_ACCESS) {
      // Without a role there, any visibility rule on the table hides it.
      return (
        noRoleHides ||
        (await hasTableVisibilityRule(refContext, relatedModelId))
      );
    }
  }
  return !(await isTableVisible(refContext, relatedModelId, relatedUser));
}

/**
 * Whether a visibility rule (TABLE_VISIBILITY permission, or a view disabled
 * for some role by UI ACL) applies to the table in `context`'s base.
 */
export async function hasTableVisibilityRule(
  context: NcContext,
  tableId: string,
): Promise<boolean> {
  const permissions = await Permission.list(context, context.base_id);
  if (
    permissions.some(
      (p) =>
        p.entity === PermissionEntity.TABLE &&
        p.entity_id === tableId &&
        p.permission === PermissionKey.TABLE_VISIBILITY,
    )
  ) {
    return true;
  }
  const disabledViewIds = new Set(
    (await ModelRoleVisibility.list(context, context.base_id))
      .filter((entry) => entry.disabled)
      .map((entry) => entry.fk_view_id),
  );
  if (!disabledViewIds.size) return false;
  const views = await View.list(context, tableId);
  return views.some((view) => disabledViewIds.has(view.id));
}

// Per request context: link column id -> verdict.
const linkTargetVerdicts = new WeakMap<object, Map<string, Promise<boolean>>>();

/**
 * Whether a link's related table is hidden from the requester. Unlike
 * `hasLimitedLinkTargetAccess`, a shared view is not limited by itself, and a
 * read with no user that is not a public share (jobs, webhooks) is not limited.
 */
export async function isLinkTargetHidden(
  context: NcContext,
  colOptions: LinkToAnotherRecordColumn,
): Promise<boolean> {
  const publicShare =
    isSharedViewAccess(context) ||
    context.access_source === NcAccessSource.SHARED_BASE;
  if (!context.user ? !publicShare : isServiceUser(context.user)) return false;
  if (
    context.access_source === NcAccessSource.SHARED_BASE &&
    colOptions.isCrossBaseLink()
  ) {
    return true;
  }

  let verdicts = linkTargetVerdicts.get(context);
  if (!verdicts) linkTargetVerdicts.set(context, (verdicts = new Map()));
  const key = colOptions.fk_column_id;
  let verdict = key ? verdicts.get(key) : undefined;
  if (!verdict) {
    const refContext = relatedBaseContext(context, colOptions);
    // Hidden only when a visibility rule applies to the related table: no
    // role in its base alone does not hide it.
    verdict = isTargetHiddenIn(
      refContext,
      colOptions,
      colOptions.fk_related_model_id,
      { rolesFromOtherBase: refContext.base_id !== rolesBaseOf(context) },
    );
    if (key) verdicts.set(key, verdict);
  }
  return verdict;
}

// Moved context -> the base its user's roles belong to.
const movedContextRolesBase = new WeakMap<object, string>();

function rolesBaseOf(context: NcContext): string {
  return movedContextRolesBase.get(context) ?? context.base_id;
}

// The request context moved to the link's related base.
export function relatedBaseContext(
  context: NcContext,
  colOptions: LinkToAnotherRecordColumn,
): NcContext {
  const { refContext } = colOptions.getRelContext();
  if (refContext.base_id === context.base_id) return context;
  const moved = {
    ...context,
    workspace_id: refContext.workspace_id,
    base_id: refContext.base_id,
    permissions: undefined,
  };
  movedContextRolesBase.set(moved, rolesBaseOf(context));
  return moved;
}

const MAX_HIDDEN_CHAIN_DEPTH = 8;
// Per request context: column id -> verdict.
const hiddenColumnVerdicts = new WeakMap<
  object,
  Map<string, Promise<boolean>>
>();

/**
 * Whether a Lookup or Rollup reads, at any hop of its chain, a table hidden
 * from the requester. Such a field must read as null and not filter.
 */
export async function readsHiddenTable(
  context: NcContext,
  column: Column,
): Promise<boolean> {
  if (column?.uidt !== UITypes.Lookup && column?.uidt !== UITypes.Rollup) {
    return false;
  }
  let verdicts = hiddenColumnVerdicts.get(context);
  if (!verdicts) hiddenColumnVerdicts.set(context, (verdicts = new Map()));
  let verdict = verdicts.get(column.id);
  if (!verdict) {
    verdict = readsHiddenTableUncached(context, column);
    verdicts.set(column.id, verdict);
  }
  return verdict;
}

/**
 * Cache-key segment for a compiled read of a model: its fields, and those of
 * the tables it links to (display values), that read a hidden table compile to
 * NULL, so plans must not be shared across verdicts.
 */
export async function hiddenTableReadsSegment(
  context: NcContext,
  columns: Column[],
): Promise<string> {
  const hidden: string[] = [];
  for (const column of columns ?? []) {
    if (await readsHiddenTable(context, column)) hidden.push(column.id);
    if (!isLinksOrLTAR(column)) continue;
    const link = await column.getColOptions<LinkToAnotherRecordColumn>();
    if (!link) continue;
    const linkedContext = relatedBaseContext(context, link);
    const linkedModel = await Model.get(
      link.getRelContext().refContext,
      link.fk_related_model_id,
    );
    for (const linkedColumn of (await linkedModel?.getColumns()) ?? []) {
      if (await readsHiddenTable(linkedContext, linkedColumn)) {
        hidden.push(`${column.id}.${linkedColumn.id}`);
      }
    }
  }
  return hidden.length ? `:hid:${hidden.sort().join(',')}` : '';
}

async function readsHiddenTableUncached(
  context: NcContext,
  column: Column,
): Promise<boolean> {
  for (const hop of await lookupChainHops(context, column)) {
    if (await isLinkTargetHidden(hop.context, hop.link)) return true;
  }
  return false;
}

/**
 * The link of each hop a Lookup or Rollup reads through, with the field that
 * reads it and the request context moved to the base that hop starts in.
 */
export async function lookupChainHops(
  context: NcContext,
  column: Column,
): Promise<
  { context: NcContext; link: LinkToAnotherRecordColumn; column: Column }[]
> {
  const hops: {
    context: NcContext;
    link: LinkToAnotherRecordColumn;
    column: Column;
  }[] = [];
  let hopContext = context;
  let current = column;
  while (
    hops.length <= MAX_HIDDEN_CHAIN_DEPTH &&
    (current?.uidt === UITypes.Lookup || current?.uidt === UITypes.Rollup)
  ) {
    const colOptions = await current.getColOptions<
      LookupColumn | RollupColumn
    >();
    if (!colOptions || colOptions.error) break;
    const relationColumn = await colOptions.getRelationColumn();
    const link =
      await relationColumn?.getColOptions<LinkToAnotherRecordColumn>();
    if (!link) break;
    hops.push({ context: hopContext, link, column: current });

    current =
      current.uidt === UITypes.Lookup
        ? await (colOptions as LookupColumn).getLookupColumn()
        : await (colOptions as RollupColumn).getRollupColumn();
    hopContext = relatedBaseContext(hopContext, link);
  }
  // A lookup of a link field also reads the table that link points to.
  if (hops.length && current && isLinksOrLTAR(current)) {
    const link = await current.getColOptions<LinkToAnotherRecordColumn>();
    if (link) hops.push({ context: hopContext, link, column: current });
  }
  return hops;
}

function runRolesInBase(
  owner: Awaited<ReturnType<typeof User.getWithRoles>> | null | undefined,
  cap: AgentRoleCap | null | undefined,
): Record<string, boolean> | null {
  const role = owner ? personalAgentRole(getStandingRole(owner), cap) : null;
  return role ? { [role]: true } : null;
}

// Per request user object: base id -> that user with its roles in that base.
const relatedBaseUsers = new WeakMap<object, Map<string, Promise<any>>>();

/**
 * The request user carries its roles in the REQUEST base; a cross-base link's
 * TABLE_VISIBILITY rule must be read against its role in the related base.
 * Service users and agents keep the request roles; a personal agent's run is
 * its owner there, capped as in the request base.
 */
async function userInRelatedBase(
  refContext: NcContext,
): Promise<NcRequest['user']> {
  const user = refContext.user as NcRequest['user'] & { is_agent?: boolean };
  if (!user?.id || isServiceUser(user) || user.is_agent) return user;

  let byBase = relatedBaseUsers.get(user);
  if (!byBase) relatedBaseUsers.set(user, (byBase = new Map()));

  let pending = byBase.get(refContext.base_id);
  if (!pending) {
    pending = User.getWithRoles(refContext, user.id, {
      baseId: refContext.base_id,
      workspaceId: refContext.workspace_id,
    })
      .then((withRoles) => ({
        ...user,
        roles: withRoles?.roles ?? null,
        base_roles: user.acting_agent
          ? runRolesInBase(withRoles, user.acting_agent.role_cap)
          : withRoles?.base_roles ?? null,
        workspace_roles: withRoles?.workspace_roles ?? null,
        is_app_effective_role: undefined,
        real_base_role: undefined,
      }))
      .catch(() => ({
        ...user,
        roles: null,
        base_roles: null,
        is_app_effective_role: undefined,
        real_base_role: undefined,
      }));
    byBase.set(refContext.base_id, pending);
  }
  return pending;
}
