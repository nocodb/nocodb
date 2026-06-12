import { Logger } from '@nestjs/common';
import {
  DocCollabClientEvents,
  EventType,
  extractRolesObj,
  getDocSyncRoom,
  hasMinimumRoleAccess,
  isLinksOrLTAR,
  type PayloadForEvent,
  PermissionKey,
  ProjectRoles,
  UITypes,
  validateRowFilters,
  ViewTypes,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import * as Y from 'yjs';
import { sendConnectionError, sendWelcomeMessage } from './genericEvents';
import { RlsSubscriptionRegistry } from './RlsSubscriptionRegistry';
import type { ColumnType, FilterType } from 'nocodb-sdk';
import type { Server } from 'socket.io';
import type { NcContext, NcSocket } from '~/interface/config';
import type { Prettify } from '~/types/utils';
import NocoPresence from '~/socket/NocoPresence';
import { DocumentCollabManager } from '~/socket/DocumentCollabManager';
import { DocCollabPubSub } from '~/socket/DocCollabPubSub';
import {
  encodeSyncStep1,
  handleSyncMessage,
} from '~/socket/documentSyncProtocol';
import { isDocsRealtimeEnabled } from '~/helpers/dbHelpers';
import { DocumentsService } from '~/services/documents.service';
import { verifyJwt } from '~/services/users/helpers';
import {
  BaseUser,
  ListViewLevel,
  Model,
  Source,
  User,
  View,
  WorkspaceUser,
} from '~/models';
import { PrincipalAssignment } from '~/ee/models';
import Filter from '~/models/Filter';
import RlsPolicy from '~/ee/models/RlsPolicy';
import {
  resolveRlsDynamicValues,
  type RlsUserContext,
} from '~/ee/utils/rls-resolver';
import Noco from '~/Noco';
import { chunkArray } from '~/utils/tsUtils';
import { PrincipalType, ResourceType } from '~/utils/globals';
import { getProjectRolePower } from '~/utils/roleHelper';
import { getWorkspaceRolePower } from '~/utils/roleHelper';

export default class NocoSocket {
  private static logger: Logger = new Logger(NocoSocket.name);
  private static clients: Map<string, NcSocket> = new Map();
  public static ioServer: Server | undefined;

  /**
   * Hard cap on a single inbound Yjs frame (decoded bytes). A normal edit is a
   * few bytes; even a large paste rarely exceeds a few hundred KB. Anything
   * above this is rejected so a malformed or hostile client can't OOM the node
   * or fan out a giant payload to every peer. Override via NC_DOCS_MAX_UPDATE_SIZE.
   */
  private static readonly MAX_DOC_FRAME_BYTES =
    Number(process.env.NC_DOCS_MAX_UPDATE_SIZE) || 5 * 1024 * 1024;

  /**
   * Optional per-node cap on concurrent live doc sessions; 0 = unlimited
   * (default). Past the cap, new docs stay on REST (realtime is additive).
   */
  private static readonly MAX_LOCAL_DOC_SESSIONS =
    Number(process.env.NC_DOCS_MAX_LOCAL_SESSIONS) || 0;

  public static handleConnection(socket: NcSocket) {
    this.clients.set(socket.id, socket);
    this.logger.debug(`Client connected: ${socket.id}`);

    socket.once('handshake', async (args, callback) => {
      if (callback && typeof callback === 'function') {
        try {
          socket.user = verifyJwt(args?.token, Noco.getConfig()); // Attach user to socket handshake
          sendWelcomeMessage(socket);

          // join for user-specific events
          socket.join(`user:${socket.user.id}`);

          // Set up event handlers for this client
          this.setupClientEventHandlers(socket);
        } catch (e) {
          sendConnectionError(
            socket,
            new Error('Authentication failed'),
            'AUTH_ERROR',
          );
          return;
        }
        // Validate and process handshake args if needed
        callback({ status: 'ok' });
      }
    });
  }

  private static async subscribeEvent(socket: NcSocket, event: string) {
    try {
      const eventHelper = event.split(':');
      if (eventHelper.length < 2) {
        this.logger.warn(`Invalid event format: ${event}`);
        return;
      }

      const user = socket.user;
      if (!user || !user.id) {
        this.logger.warn(`User not authenticated for event: ${event}`);
        return;
      }

      const eventType = eventHelper[0];
      const workspaceId = eventHelper[1];
      // Base ID is optional, if not provided, it will be undefined
      const baseId = eventHelper[2];

      const userWithRole = await User.getWithRoles(
        {
          workspace_id: workspaceId,
          base_id: baseId,
        },
        user.id,
        {
          user,
          workspaceId,
          baseId,
        },
      );

      if (
        [EventType.WORKFLOW_EVENT].includes(eventType as EventType) &&
        !hasMinimumRoleAccess(userWithRole, ProjectRoles.CREATOR)
      ) {
        return;
      }

      // Check permissions based on event type
      if (
        [
          EventType.DATA_EVENT,
          EventType.DASHBOARD_EVENT,
          EventType.WIDGET_EVENT,
          EventType.SCRIPT_EVENT,
          EventType.PRESENCE_EVENT,
          EventType.SMART_TEXT_EVENT,
          EventType.DOCUMENT_SYNC_EVENT,
        ].includes(eventType as EventType) &&
        userWithRole.base_roles?.[ProjectRoles.NO_ACCESS]
      ) {
        return;
      }

      // RLS-aware subscription for DATA_EVENT
      if (
        eventType === EventType.DATA_EVENT &&
        eventHelper.length >= 4 &&
        baseId
      ) {
        const tableId = eventHelper[3];
        if (tableId) {
          const rlsRoom = await this.resolveRlsRoom(
            socket,
            event,
            { workspace_id: workspaceId, base_id: baseId },
            tableId,
            userWithRole,
          );
          if (rlsRoom !== null) {
            // rlsRoom handled joining — skip default join
            return;
          }
          // rlsRoom === null means no RLS — fall through to default
        }
      }

      // Collaborative docs: handled before the default join so a socket denied
      // per-document visibility never joins the sync room (and therefore never
      // receives the live update/awareness frames broadcast to it). The room
      // join lives inside subscribeDocSync, after the visibility check.
      if (eventType === EventType.DOCUMENT_SYNC_EVENT) {
        if (baseId && isDocsRealtimeEnabled()) {
          const docId = eventHelper[3];
          if (docId) {
            await this.subscribeDocSync(
              socket,
              { workspace_id: workspaceId, base_id: baseId },
              docId,
              userWithRole,
              event,
            );
          }
        }
        // Never fall through to the unconditional default join below.
        return;
      }

      // Use native Socket.IO rooms (default — no RLS)
      socket.join(event);
      this.logger.debug(`Socket ${socket.id} joined room ${event}`);

      // Track presence room in socket.data for safe disconnect cleanup
      // (socket.rooms may be cleared before disconnect handler fires).
      // presenceRoom: single room key string — one base-scoped room per socket.
      if (event.startsWith(EventType.PRESENCE_EVENT)) {
        if (!socket.data.presenceRooms) socket.data.presenceRooms = new Set();
        socket.data.presenceRooms.add(event);

        // Store as the active presence room (base-level — one at a time)
        socket.data.presenceRoom = event;
      }
    } catch (error) {
      this.logger.error(`Error subscribing to event ${event}:`, error);
      sendConnectionError(socket, error, 'SUBSCRIBE_ERROR');
    }
  }

  /**
   * Bind a socket to a doc's server-authoritative Y.Doc. Enforces the same
   * per-document DOCUMENT_VISIBILITY/DOCUMENT_EDIT permissions the REST docs
   * endpoints apply (the base-level NO_ACCESS check in subscribeEvent isn't
   * enough — a member can be restricted from a specific private page), then
   * registers the session and runs the server-initiated Yjs handshake.
   */
  private static async subscribeDocSync(
    socket: NcSocket,
    context: { workspace_id: string; base_id: string },
    docId: string,
    userWithRole: any,
    event: string,
  ) {
    const docsService = Noco.nestApp?.get(DocumentsService);
    if (!docsService) {
      this.logger.error(
        'DocumentsService unavailable — refusing doc sync subscription',
      );
      return;
    }
    const docUser = { id: socket.user.id, base_roles: userWithRole.base_roles };

    const canRead = await docsService.hasDocPermission(
      context,
      docId,
      PermissionKey.DOCUMENT_VISIBILITY,
      docUser,
    );
    if (!canRead) {
      this.logger.debug(
        `Socket ${socket.id} denied doc sync (visibility) for ${docId}`,
      );
      return;
    }

    if (
      this.MAX_LOCAL_DOC_SESSIONS > 0 &&
      !DocumentCollabManager.isLiveLocal(docId) &&
      DocumentCollabManager.sessionCount() >= this.MAX_LOCAL_DOC_SESSIONS
    ) {
      this.logger.warn(
        `Doc session cap reached (${this.MAX_LOCAL_DOC_SESSIONS}); ${docId} stays on REST`,
      );
      return;
    }

    // Authorized reader — join the sync room NOW, after the per-document
    // visibility check. Joining earlier (e.g. via the default join in
    // subscribeEvent) would leak the live update/awareness frames broadcast to
    // this room to a member who is denied this specific page.
    socket.join(event);
    this.logger.debug(`Socket ${socket.id} joined doc sync room ${event}`);

    const session = await DocumentCollabManager.ensure(context, docId);
    DocumentCollabManager.addSocket(docId, socket.id);
    await DocCollabPubSub.ensureSubscribed(docId);

    if (!socket.data.docSessions) socket.data.docSessions = new Map();
    socket.data.docSessions.set(docId, session);
    if (!socket.data.docRooms) socket.data.docRooms = new Set();
    socket.data.docRooms.add(event);

    // Read-only unless the user has base editor access AND doc-level edit
    // permission. Updates from a read-only socket are ignored.
    const canEdit =
      hasMinimumRoleAccess(userWithRole, ProjectRoles.EDITOR) &&
      (await docsService.hasDocPermission(
        context,
        docId,
        PermissionKey.DOCUMENT_EDIT,
        docUser,
      ));
    if (!canEdit) {
      if (!socket.data.docReadOnly) socket.data.docReadOnly = new Set();
      socket.data.docReadOnly.add(docId);
    }

    // Single-seeder grant for an empty (legacy) doc — only an editor may claim,
    // since a read-only client's seed would be rejected and never persist (see
    // claimBootstrap).
    const mayBootstrap =
      canEdit && (await DocumentCollabManager.claimBootstrap(context, docId));

    // Server-initiated Yjs handshake (race-free — the session exists now). The
    // client replies with its own step1 and both sides converge. No socketId, so
    // the client's own-echo filter delivers it.
    socket.emit(event, {
      kind: 'sync',
      docId,
      frame: Buffer.from(encodeSyncStep1(session.ydoc)).toString('base64'),
      mayBootstrap,
    });
  }

  /**
   * Resolve RLS room for a DATA_EVENT subscription.
   * Returns the RLS room name if RLS is active, or null if no RLS (fall through to default).
   */
  private static async resolveRlsRoom(
    socket: NcSocket,
    originalEvent: string,
    context: { workspace_id: string; base_id: string },
    tableId: string,
    userWithRole: any,
  ): Promise<string | null> {
    const ncContext: NcContext = {
      workspace_id: context.workspace_id,
      base_id: context.base_id,
    };

    const hasRls = await RlsPolicy.hasEnabledPolicies(ncContext, tableId);
    if (!hasRls) {
      return null; // No RLS — use default room
    }

    const user = socket.user;

    // Build RLS user context
    let baseRoles = '';
    if (userWithRole.base_roles) {
      const roles =
        typeof userWithRole.base_roles === 'string'
          ? JSON.parse(userWithRole.base_roles)
          : userWithRole.base_roles;
      baseRoles = Object.keys(roles)
        .filter((r) => roles[r])
        .join(',');
    }

    const rlsUser: RlsUserContext = {
      id: user.id,
      email: user.email,
      roles: baseRoles,
    };

    // Resolve which policies match this user (by subject)
    const allPolicies = await RlsPolicy.listByModel(ncContext, tableId);
    const enabledPolicies = allPolicies.filter((p) => p.enabled);
    const defaultPolicy = enabledPolicies.find((p) => p.is_default);
    const scopedPolicies = enabledPolicies.filter((p) => !p.is_default);

    // Check which scoped policies match the user
    const matchedPolicyIds: string[] = [];
    for (const policy of scopedPolicies) {
      if (policy.subjects?.length) {
        for (const subject of policy.subjects) {
          if (subject.type === 'role' && baseRoles.includes(subject.id)) {
            matchedPolicyIds.push(policy.id);
            break;
          }
          if (subject.type === 'user' && user.id === subject.id) {
            matchedPolicyIds.push(policy.id);
            break;
          }
          if (subject.type === 'team') {
            const assignment = await PrincipalAssignment.get(
              ncContext,
              ResourceType.TEAM,
              subject.id,
              PrincipalType.USER,
              user.id,
            );
            if (assignment) {
              matchedPolicyIds.push(policy.id);
              break;
            }
          }
        }
      }
    }

    // Determine which policy IDs to load filters from
    let policyIdsForFilters: string[];

    if (matchedPolicyIds.length > 0) {
      policyIdsForFilters = matchedPolicyIds;
    } else if (defaultPolicy) {
      if (defaultPolicy.default_behavior === 'deny_all') {
        // User sees nothing — don't join any room
        this.logger.debug(
          `Socket ${socket.id} denied (RLS deny_all) for table ${tableId}`,
        );
        return '__denied__'; // Non-null to prevent default room join
      }
      if (defaultPolicy.default_behavior === 'condition') {
        policyIdsForFilters = [defaultPolicy.id];
      } else {
        // show_all — no filter restrictions
        policyIdsForFilters = [];
      }
    } else {
      // No matching scoped policies, no default → see all
      policyIdsForFilters = [];
    }

    // Load and resolve filters
    const resolvedFilters: FilterType[] = [];
    for (const policyId of policyIdsForFilters) {
      const filters = await Filter.rootFilterListByRlsPolicy(ncContext, {
        rlsPolicyId: policyId,
      });
      if (filters?.length) {
        const resolved = resolveRlsDynamicValues(filters, rlsUser);
        resolvedFilters.push(...resolved);
      }
    }

    // Load table columns and source client type for filter evaluation at broadcast time
    const model = await Model.getWithInfo(ncContext, { id: tableId });
    const columns: ColumnType[] = model?.columns || [];
    const source = model?.source_id
      ? await Source.get(ncContext, model.source_id)
      : null;
    const client = source?.type || 'pg';

    // Compute access hash
    const accessHash =
      RlsSubscriptionRegistry.computeAccessHash(resolvedFilters);

    // Register in registry
    RlsSubscriptionRegistry.register(
      socket.id,
      tableId,
      accessHash,
      resolvedFilters,
      columns,
      client,
    );

    // Join the RLS room (using original event key as prefix for proper namespacing)
    const rlsRoom = `${originalEvent}:rls:${accessHash}`;
    socket.join(rlsRoom);

    this.logger.debug(
      `Socket ${socket.id} joined RLS room ${rlsRoom} (hash: ${accessHash}, ${resolvedFilters.length} filters)`,
    );

    return rlsRoom;
  }

  public static broadcastEvent<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
      scopes?: string[];
    },
    socketId?: string,
  ) {
    try {
      const { event, payload, scopes = [] } = params;

      const eventKey = `${event}:${context.workspace_id}:${context.base_id}${
        scopes.length > 0 ? `:${scopes.join(':')}` : ''
      }`;

      const finalPayload = {
        ...payload,
        event,
        timestamp: Date.now(),
        socketId,
      };

      if (this.ioServer) {
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
      } else {
        this.logger.warn(`No server instance available for event: ${eventKey}`);
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event ${params.event}`);
      this.logger.error(error);
    }
  }

  public static broadcastEventToUser<T extends EventType>(
    userId: string,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
  ) {
    try {
      const { event, payload } = params;

      const eventKey = `user:${userId}`;

      const finalPayload = {
        ...payload,
        event,
        timestamp: Date.now(),
        socketId,
      };

      if (this.ioServer) {
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
      } else {
        this.logger.warn(`No server instance available for event: ${eventKey}`);
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to user ${userId}`);
      this.logger.error(error);
    }
  }

  public static async broadcastEventToWorkspaceUsers<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
    minimumRole = WorkspaceUserRoles.VIEWER,
  ) {
    try {
      const users = await WorkspaceUser.userList({
        fk_workspace_id: context.workspace_id,
      });

      Object.assign(params.payload, {
        workspaceId: context.workspace_id,
      });

      for (const user of users) {
        if (
          getWorkspaceRolePower({
            workspace_roles: extractRolesObj(user.roles),
          }) >=
          getWorkspaceRolePower({
            workspace_roles: extractRolesObj(minimumRole),
          })
        ) {
          this.broadcastEventToUser(user.id, params, socketId);
        }
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to workspace users`);
      this.logger.error(error);
    }
  }

  public static async broadcastEventToBaseUsers<T extends EventType>(
    context: NcContext,
    params: {
      event: T;
      payload: Prettify<Omit<PayloadForEvent<T>, 'timestamp' | 'socketId'>>;
    },
    socketId?: string,
    minimumRole = ProjectRoles.VIEWER,
  ) {
    try {
      const users = await BaseUser.getUsersList(context, {
        base_id: context.base_id,
      });

      Object.assign(params.payload, {
        baseId: context.base_id,
        workspaceId: context.workspace_id,
      });

      for (const user of users) {
        const userRole =
          user.roles ??
          WorkspaceRolesToProjectRoles[user.workspace_roles] ??
          ProjectRoles.NO_ACCESS;
        if (
          getProjectRolePower({ base_roles: extractRolesObj(userRole) }) >=
          getProjectRolePower({ base_roles: extractRolesObj(minimumRole) })
        ) {
          this.broadcastEventToUser(user.id, params, socketId);
        }
      }
    } catch (error) {
      this.logger.error(`Error broadcasting event to base users`);
      this.logger.error(error);
    }
  }

  /**
   * RLS-aware data event broadcast.
   * If the table has active RLS subscriptions, evaluates the row against each
   * access group's filters and only emits to matching rooms.
   * If no RLS, falls through to the standard broadcastEvent.
   */
  public static async broadcastDataEvent(
    context: NcContext,
    params: {
      payload: {
        id: string;
        action: 'add' | 'update' | 'delete' | 'reorder';
        payload: Record<string, any> | null;
        before?: string;
      };
      tableId: string;
    },
    socketId?: string,
  ) {
    try {
      const { payload, tableId } = params;
      const eventKey = `${EventType.DATA_EVENT}:${context.workspace_id}:${context.base_id}:${tableId}`;

      let matchedViewIds: string[] | undefined;
      if (
        (payload.action === 'add' || payload.action === 'update') &&
        payload.payload
      ) {
        try {
          matchedViewIds = await this.computeMatchedViewIds(
            context,
            tableId,
            payload.payload,
          );
        } catch (err) {
          this.logger.error('Error computing matchedViewIds for data event');
          this.logger.error(err);
          matchedViewIds = undefined;
        }
      }

      const finalPayload = {
        ...payload,
        event: EventType.DATA_EVENT,
        timestamp: Date.now(),
        socketId,
        ...(matchedViewIds ? { matchedViewIds } : {}),
      };

      if (!this.ioServer) {
        this.logger.warn(`No server instance available for event: ${eventKey}`);
        return;
      }

      const groups = RlsSubscriptionRegistry.getGroups(tableId);

      if (!groups || groups.size === 0) {
        // No RLS subscriptions — broadcast to standard room
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
        return;
      }

      // For delete events, broadcast to ALL RLS rooms (removing a row from
      // everyone's view is safe — no data content is leaked)
      if (payload.action === 'delete') {
        // Emit to standard room (for non-RLS subscribers)
        this.ioServer.to(eventKey).emit(eventKey, finalPayload);
        // Emit to each RLS room
        for (const [hash] of groups) {
          const rlsRoom = `${eventKey}:rls:${hash}`;
          this.ioServer.to(rlsRoom).emit(eventKey, finalPayload);
        }
        return;
      }

      // For add/update/reorder — evaluate row against each access group's filters
      const rowData = payload.payload;

      // Also emit to standard room for subscribers without RLS
      this.ioServer.to(eventKey).emit(eventKey, finalPayload);

      for (const [hash, group] of groups) {
        const rlsRoom = `${eventKey}:rls:${hash}`;

        // "all" hash means no filters — user sees everything
        if (hash === 'all') {
          this.ioServer.to(rlsRoom).emit(eventKey, finalPayload);
          continue;
        }

        // Evaluate if this row passes the group's filters
        if (
          rowData &&
          group.resolvedFilters.length > 0 &&
          group.columns.length > 0
        ) {
          const passes = validateRowFilters({
            filters: group.resolvedFilters,
            data: rowData,
            columns: group.columns,
            client: group.client,
            metas: {},
          });

          if (passes) {
            this.ioServer.to(rlsRoom).emit(eventKey, finalPayload);
          }
        } else if (!group.resolvedFilters.length) {
          // No filters = see everything
          this.ioServer.to(rlsRoom).emit(eventKey, finalPayload);
        }
      }
    } catch (error) {
      this.logger.error('Error in broadcastDataEvent');
      this.logger.error(error);
    }
  }

  public static async broadcastBulkDataEvent(
    context: NcContext,
    params: {
      tableId: string;
      rows: Array<{
        id: string;
        action: 'add' | 'update' | 'delete';
        payload: Record<string, any> | null;
      }>;
    },
    socketId?: string,
  ) {
    try {
      const io = this.ioServer;
      if (!io) return;

      const { tableId, rows } = params;
      if (!rows?.length) return;

      const eventKey = `${EventType.DATA_EVENT}:${context.workspace_id}:${context.base_id}:${tableId}`;

      const needMatch = rows.some(
        (r) => r.action === 'add' || r.action === 'update',
      );
      const ctx = needMatch
        ? await this.getViewFilterContext(context, tableId)
        : null;
      const enriched = rows.map((r) => ({
        id: r.id,
        action: r.action,
        payload: r.payload,
        ...(ctx && r.payload && (r.action === 'add' || r.action === 'update')
          ? { matchedViewIds: this.matchRowToViews(ctx, r.payload) }
          : {}),
      }));

      const emitBatch = (room: string, batch: typeof enriched) => {
        for (const frame of chunkArray(batch, 200)) {
          io.to(room).emit(eventKey, {
            id: '',
            action: 'bulk',
            payload: null,
            rows: frame,
            event: EventType.DATA_EVENT,
            timestamp: Date.now(),
            socketId,
          });
        }
      };

      // Standard room (non-RLS subscribers) — all rows.
      emitBatch(eventKey, enriched);

      const groups = RlsSubscriptionRegistry.getGroups(tableId);
      if (!groups || groups.size === 0) return;

      for (const [hash, group] of groups) {
        const rlsRoom = `${eventKey}:rls:${hash}`;

        // "all" / no group filters → the room sees everything.
        if (hash === 'all' || !group.resolvedFilters?.length) {
          emitBatch(rlsRoom, enriched);
          continue;
        }

        // Deletes are safe for everyone; adds/updates only if the row passes the group's
        // filters — so an RLS room never receives rows its policy hides.
        const visible = enriched.filter((r) =>
          r.action === 'delete'
            ? true
            : !!r.payload &&
              group.columns.length > 0 &&
              validateRowFilters({
                filters: group.resolvedFilters,
                data: r.payload,
                columns: group.columns,
                client: group.client,
                metas: {},
              }),
        );
        emitBatch(rlsRoom, visible);
      }
    } catch (error) {
      this.logger.error('Error in broadcastBulkDataEvent');
      this.logger.error(error);
    }
  }

  /**
   * Return the ids of views whose filters this record matches (no filters → always matches),
   * so realtime membership is decided server-side for all roles. Covers regular views (saved
   * filters) and list views (per-level filters for the level mapped to this table).
   */
  private static async computeMatchedViewIds(
    context: NcContext,
    tableId: string,
    rowData: Record<string, any>,
  ): Promise<string[] | undefined> {
    const ctx = await this.getViewFilterContext(context, tableId);
    return this.matchRowToViews(ctx, rowData);
  }

  /**
   * Load everything needed to evaluate rows of a table against its view filters, ONCE: columns,
   * source client, related-table metas (so link/lookup filters resolve — same metadata the client
   * used locally), and the flat filter list per regular view + per list-view level on this table.
   * Reused to match many rows in a bulk broadcast without reloading metadata per row.
   */
  private static async getViewFilterContext(
    context: NcContext,
    tableId: string,
  ): Promise<{
    columns: ColumnType[];
    client: string;
    metas: Record<string, any>;
    baseId?: string;
    filterSets: Array<{ viewId: string; filters: FilterType[] }>;
  }> {
    const model = await Model.getWithInfo(context, { id: tableId });
    const columns: ColumnType[] = model?.columns || [];
    const source = model?.source_id
      ? await Source.get(context, model.source_id)
      : null;
    const client = source?.type || 'pg';

    const metas: Record<string, any> = {};
    const addRelatedMeta = async (relatedModelId?: string) => {
      if (!relatedModelId || metas[relatedModelId]) return;
      try {
        metas[relatedModelId] = await Model.getWithInfo(context, {
          id: relatedModelId,
        });
      } catch {
        // Missing related meta just makes that filter evaluate to no-match — safe.
      }
    };
    for (const col of columns) {
      const colOpt = col.colOptions as any;
      if (!colOpt) continue;
      if (isLinksOrLTAR(col.uidt)) {
        await addRelatedMeta(colOpt.fk_related_model_id);
      } else if (col.uidt === UITypes.Lookup) {
        const relCol = columns.find(
          (c) => c.id === colOpt.fk_relation_column_id,
        );
        await addRelatedMeta((relCol?.colOptions as any)?.fk_related_model_id);
      }
    }

    const filterSets: Array<{ viewId: string; filters: FilterType[] }> = [];

    // Regular views — saved filters. allViewFilterList returns the FLAT full list (parents +
    // nested children) that validateRowFilters -> buildFilterTree needs.
    const views = await View.list(context, tableId);
    for (const view of views ?? []) {
      // List views are handled per-level below (a list view spans multiple tables and isn't a
      // "view of" its parent tables, so its membership is level-scoped).
      if (view.type === ViewTypes.LIST) continue;
      const filters = await Filter.allViewFilterList(context, {
        viewId: view.id,
      });
      filterSets.push({ viewId: view.id, filters: filters ?? [] });
    }

    // List views: View.list(tableId) only surfaces a list view when tableId is its leaf, so look
    // up every list-view level on this table (leaf or parent) and take that level's own
    // (fk_level_id-scoped) filters.
    const listLevels = await ListViewLevel.listByModelId(context, tableId);
    for (const level of listLevels ?? []) {
      if (
        !level.fk_view_id ||
        filterSets.some((s) => s.viewId === level.fk_view_id)
      ) {
        continue;
      }
      const viewFilters = await Filter.allViewFilterList(context, {
        viewId: level.fk_view_id,
      });
      filterSets.push({
        viewId: level.fk_view_id,
        filters: (viewFilters ?? []).filter((f) => f.fk_level_id === level.id),
      });
    }

    return { columns, client, metas, baseId: model?.base_id, filterSets };
  }

  /**
   * Evaluate one row against a prebuilt view-filter context; returns the ids of matching views
   * (a view with no filters always matches).
   */
  private static matchRowToViews(
    ctx: {
      columns: ColumnType[];
      client: string;
      metas: Record<string, any>;
      baseId?: string;
      filterSets: Array<{ viewId: string; filters: FilterType[] }>;
    },
    rowData: Record<string, any>,
  ): string[] {
    const matched: string[] = [];
    for (const { viewId, filters } of ctx.filterSets) {
      if (!filters.length) {
        matched.push(viewId);
        continue;
      }
      const passes = validateRowFilters({
        filters,
        data: rowData,
        columns: ctx.columns,
        client: ctx.client,
        metas: ctx.metas,
        baseId: ctx.baseId,
      });
      if (passes) matched.push(viewId);
    }
    return matched;
  }

  /**
   * Force re-subscribe all sockets for a table when RLS policies change.
   * Called from RlsService on policy create/update/delete.
   */
  public static async resubscribeTableRls(
    context: NcContext,
    tableId: string,
  ): Promise<void> {
    const eventKey = `${EventType.DATA_EVENT}:${context.workspace_id}:${context.base_id}:${tableId}`;

    // Get affected sockets before invalidating
    const affectedSocketIds = RlsSubscriptionRegistry.invalidateTable(tableId);

    for (const socketId of affectedSocketIds) {
      const socket = this.clients.get(socketId);
      if (!socket) continue;

      // Leave old RLS rooms for this table
      for (const room of socket.rooms) {
        if (room.startsWith(`${eventKey}:rls:`)) {
          socket.leave(room);
        }
      }

      // Re-run subscribe to get new rooms
      // The socket originally subscribed to the base eventKey
      await this.subscribeEvent(socket, eventKey);
    }
  }

  private static setupClientEventHandlers(socket: NcSocket) {
    socket.on('event:subscribe', (event: string) => {
      this.subscribeEvent(socket, event);
    });

    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
        serverTimestamp: new Date().toISOString(),
      });
    });

    // ── Presence ──────────────────────────────────────────────────────────────
    NocoPresence.setupHandlers(socket);

    // ── Collaborative docs ──────────────────────────────────────────────────────
    // Isolated: doc-collab is optional, so a setup failure here must never break
    // core realtime (presence, live data) for the whole connection.
    try {
      this.setupDocCollabHandlers(socket);
    } catch (e) {
      this.logger.error(`Failed to set up doc collab handlers: ${e}`);
    }

    // Error handling
    socket.on('error', (error: Error) => {
      this.logger.error(`Socket error from ${socket.id}: ${error}`);
      sendConnectionError(socket, error, 'SOCKET_ERROR');
    });

    socket.on('disconnect', (reason: string) => {
      this.logger.debug(`Client ${socket.id} disconnected: ${reason}`);

      // Clean up RLS subscription registry
      RlsSubscriptionRegistry.unregisterSocket(socket.id);

      // Remove from Redis and notify room members (delegated to NocoPresence).
      // Uses socket.data.presenceRooms (not socket.rooms) to avoid the race
      // condition where socket.rooms is cleared before the disconnect handler fires.
      NocoPresence.handleDisconnect(socket, this.ioServer);

      // Release collaborative-doc sessions held by this socket (final persist
      // + teardown happens inside DocumentCollabManager.release on last socket).
      for (const room of socket.data.docRooms ?? []) {
        const docId = (room as string).split(':')[3];
        if (!docId) continue;
        // Drop this socket's cursors from peers immediately. An abrupt
        // disconnect can't send its own awareness(null), so without this the
        // ghost cursor lingers until the client-side awareness timeout reaps it.
        const removal = DocumentCollabManager.buildSocketAwarenessRemoval(
          docId,
          socket.id,
        );
        if (removal) {
          this.ioServer?.to(room as string).emit(room as string, {
            kind: 'awareness',
            docId,
            update: removal,
          });
        }
        void DocumentCollabManager.release(docId, socket.id);
      }

      this.clients.delete(socket.id);

      if (reason === 'io server disconnect') {
        sendConnectionError(
          socket,
          new Error('Server initiated disconnect'),
          'SERVER_DISCONNECT',
        );
      }
    });
  }

  /**
   * Collaborative-docs (Yjs) socket handlers. The socket must have subscribed
   * to the doc's sync room first (see subscribeEvent → DOCUMENT_SYNC_EVENT),
   * which populates socket.data.docSessions.
   */
  /** A doc's sync room, derived from the validated session — never client-supplied. */
  private static docRoomFor(
    session: { context: { workspace_id: string; base_id: string } },
    docId: string,
  ) {
    return getDocSyncRoom(
      session.context.workspace_id,
      session.context.base_id,
      docId,
    );
  }

  private static setupDocCollabHandlers(socket: NcSocket) {
    // Yjs sync handshake: client sends SyncStep1, server replies SyncStep2.
    socket.on(DocCollabClientEvents.SYNC, (msg) => {
      const session = socket.data.docSessions?.get(msg?.docId);
      if (!session || typeof msg?.frame !== 'string') return;
      const frame = Buffer.from(msg.frame, 'base64');
      if (frame.length > this.MAX_DOC_FRAME_BYTES) {
        this.logger.warn(
          `Rejecting oversized doc sync frame (${frame.length}B) for ${msg.docId} from ${socket.id}`,
        );
        return;
      }
      let reply: Uint8Array | null;
      try {
        // A malformed/incompatible frame (e.g. surrogate-pair edge cases) can
        // throw inside the Yjs decoder. Isolate it so one bad frame can't crash
        // the gateway or wedge the shared session.
        const readOnly = socket.data.docReadOnly?.has(msg.docId) ?? false;
        reply = handleSyncMessage(session.ydoc, frame, socket.id, readOnly);
      } catch (e: any) {
        this.logger.error(
          `Doc sync apply failed for ${msg.docId}: ${e.message}`,
          e.stack,
        );
        return;
      }
      if (reply) {
        // Reply targets the requesting socket itself; no socketId so the
        // client's own-echo filter delivers it.
        const room = this.docRoomFor(session, msg.docId);
        socket.emit(room, {
          kind: 'sync',
          docId: msg.docId,
          frame: Buffer.from(reply).toString('base64'),
        });
      }
    });

    // Live edit: apply to the server Y.Doc, fan out to other clients (cluster-
    // wide via the redis-adapter, sender excluded) and to peer nodes' Y.Docs
    // (via PubSubRedis). Ignored when the socket is read-only for this doc.
    socket.on(DocCollabClientEvents.UPDATE, async (msg) => {
      const session = socket.data.docSessions?.get(msg?.docId);
      if (!session || socket.data.docReadOnly?.has(msg.docId)) return;
      if (typeof msg?.update !== 'string') return;
      const update = Buffer.from(msg.update, 'base64');
      if (update.length > this.MAX_DOC_FRAME_BYTES) {
        this.logger.warn(
          `Rejecting oversized doc update (${update.length}B) for ${msg.docId} from ${socket.id}`,
        );
        return;
      }
      try {
        // Guard the decode/apply (malformed or schema-incompatible bytes throw):
        // bail before broadcasting so peers never receive an update the server
        // itself couldn't apply.
        Y.applyUpdate(session.ydoc, update, socket.id);
      } catch (e: any) {
        this.logger.error(
          `Doc update apply failed for ${msg.docId}: ${e.message}`,
          e.stack,
        );
        return;
      }
      DocumentCollabManager.markDirty(msg.docId, socket.user?.id);
      // Fan out to OTHER clients (sender excluded by socket.to; cluster-wide via
      // the redis-adapter). The base64 string passes straight through.
      const room = this.docRoomFor(session, msg.docId);
      socket.to(room).emit(room, {
        kind: 'update',
        docId: msg.docId,
        update: msg.update,
      });
      await DocCollabPubSub.publishUpdate(msg.docId, update);
    });

    // Presence cursors: relay awareness to other clients (state is client-side).
    socket.on(DocCollabClientEvents.AWARENESS, (msg) => {
      const session = socket.data.docSessions?.get(msg?.docId);
      if (!session || typeof msg?.update !== 'string') return;
      const update = Buffer.from(msg.update, 'base64');
      // Cap awareness frames too (the SYNC/UPDATE handlers already do): a
      // malformed/hostile client must not fan out a giant payload to every peer.
      if (update.length > this.MAX_DOC_FRAME_BYTES) {
        this.logger.warn(
          `Rejecting oversized awareness frame for ${msg.docId} from ${socket.id}`,
        );
        return;
      }
      // Record which awareness clientIDs this socket owns so a disconnect can
      // drop exactly its cursors (it can't send awareness(null) itself).
      DocumentCollabManager.trackAwareness(msg.docId, socket.id, update);
      const room = this.docRoomFor(session, msg.docId);
      socket.to(room).emit(room, {
        kind: 'awareness',
        docId: msg.docId,
        update: msg.update,
      });
    });
  }
}
