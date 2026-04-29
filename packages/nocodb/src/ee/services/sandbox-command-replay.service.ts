import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type { SandboxChangelog } from '~/models';
import { CommandReplayRegistry } from '~/decorators/command-replay-registry';

/**
 * Build a mock NcRequest for replay operations.
 * __commandTraced: true prevents @TraceCommand from recording during replay.
 * __isReplay: true suppresses webhooks and audit logs.
 */
function buildReplayRequest(originalReq: NcRequest, userId: string): NcRequest {
  return {
    user: { id: userId, email: 'system@replay' },
    headers: originalReq?.headers || {},
    params: {},
    query: {},
    body: {},
    __commandTraced: true,
    __isReplay: true,
    skipAudit: true,
  } as any;
}

@Injectable()
export class SandboxCommandReplayService {
  private readonly logger = new Logger(SandboxCommandReplayService.name);
  private readonly serviceCache = new Map<Type<unknown>, unknown>();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Resolve a service instance from the NestJS DI container by class reference.
   * Uses ModuleRef with { strict: false } to search across all modules.
   * Caches resolved instances for performance.
   */
  private getService(serviceClass: Type<unknown>): any {
    const cached = this.serviceCache.get(serviceClass);
    if (cached) return cached;
    const service = this.moduleRef.get(serviceClass, { strict: false });
    this.serviceCache.set(serviceClass, service);
    return service;
  }

  /**
   * Replay a single command on the target context (master base).
   * Looks up the service + method via CommandReplayRegistry, which is populated
   * automatically by @TraceCommand at class-definition time — no manual mapping needed.
   */
  async replayCommand(
    targetContext: NcContext,
    entry: SandboxChangelog,
    originalReq: NcRequest,
  ): Promise<any> {
    const meta =
      typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
    const command = meta?.command;

    if (!command) {
      this.logger.warn(
        `Changelog entry ${entry.id} has no command data, skipping`,
      );
      return null;
    }

    const { operation, params, idField, sandboxColumns, sandboxDefaultViewId } =
      command;

    const registration = CommandReplayRegistry.get(operation);
    if (!registration) {
      this.logger.warn(
        `No replay handler registered for '${operation}' — skipping entry ${entry.id}`,
      );
      return null;
    }

    const service = this.getService(registration.serviceClass);
    if (!service || typeof service[registration.method] !== 'function') {
      this.logger.warn(
        `Cannot resolve ${registration.serviceClass.name}.${registration.method} for replay`,
      );
      return null;
    }

    const req = buildReplayRequest(originalReq, entry.created_by);

    const replayParams = {
      ...params,
      user: req.user,
      req,
    };

    // Override baseId to target master
    if (replayParams.baseId) {
      replayParams.baseId = targetContext.base_id;
    }

    // For create operations: inject the sandbox entity ID so the master entity
    // gets the same ID. metaInsert2 preserves pre-set IDs: id: data?.id || genNanoid()
    if (
      idField &&
      entry.entity_id &&
      replayParams[idField] &&
      typeof replayParams[idField] === 'object'
    ) {
      replayParams[idField] = { ...replayParams[idField], id: entry.entity_id };
    }

    // tableCreate: thread sandbox column IDs to master. _sandboxColumnIds
    // covers user cols (EE override); additionalContext covers system cols
    // (Column.bulkInsert, since CE repopulateCreateTableSystemColumns regenerates them).
    let colIdMap: Record<string, string> | undefined;
    if (sandboxColumns?.length && replayParams.table) {
      colIdMap = {};
      for (const c of sandboxColumns) {
        if (c.title) colIdMap[c.title] = c.id;
        if (c.cn) colIdMap[c.cn] = c.id;
      }
      replayParams.table = {
        ...replayParams.table,
        _sandboxColumnIds: colIdMap,
      };
    }

    // Inject the sandbox's auto-created default view ID so sorts/filters that
    // reference the new table's default view by ID resolve correctly on master.
    if (sandboxDefaultViewId && replayParams.table) {
      replayParams.table = {
        ...replayParams.table,
        _sandboxDefaultViewId: sandboxDefaultViewId,
      };
    }

    // Mark context as replay so assertNotSandboxMaster guards are bypassed.
    // The master base still has an active sandbox during merge — without this flag
    // every schema mutation would be rejected by the sandbox enforcement guards.
    const replayContext: NcContext = {
      ...targetContext,
      additionalContext: {
        ...targetContext.additionalContext,
        is_replay: true,
        ...(colIdMap ? { sandboxColumnIds: colIdMap } : {}),
      },
    };

    this.logger.log(`Replaying ${operation} (entry: ${entry.id})`);
    return service[registration.method](replayContext, replayParams);
  }
}
