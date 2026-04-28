import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppEvents, BaseVersion, EventType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Sandbox, SandboxChangelog } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  applyMeta,
  diffMeta,
  serializeMeta,
  stripDocuments,
} from '~/helpers/baseMetaHelpers';
import { MetaTable } from '~/utils/globals';
import { JobTypes } from '~/interface/Jobs';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class SandboxesService {
  protected logger = new Logger(SandboxesService.name);

  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async sandboxList(param: { baseId: string }): Promise<Sandbox[] | null> {
    const sandboxes = await Sandbox.listByMasterBaseId(param.baseId);

    return sandboxes;
  }

  async sandboxGet(
    context: NcContext,
    param: {
      sandboxId: string;
    },
  ): Promise<Sandbox | Sandbox[] | null> {
    if (param.sandboxId) {
      const sandbox = await Sandbox.get(param.sandboxId);
      return sandbox ?? null;
    }

    // Try sandbox base ID first (called from sandbox context)
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    if (sandbox) return sandbox;

    // Fall back to master base ID lookup (called from master context)
    const sandboxes = await Sandbox.listByMasterBaseId(context.base_id);
    return sandboxes?.[0] ?? null;
  }

  async sandboxDelete(
    context: NcContext,
    _param: {
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<boolean> {
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);

    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', context.base_id);
    }

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const base = await Base.get(context, sandbox.sandbox_base_id, ncMeta);
      if (!base) {
        NcError.get(context).baseNotFound(sandbox.sandbox_base_id);
      }

      const sandboxContext = {
        ...context,
        base_id: sandbox.sandbox_base_id,
      };

      // Delete changelog entries for this sandbox
      await SandboxChangelog.deleteBySandboxId(sandbox.id, ncMeta);

      // Explicitly delete the sandbox record before deleting the base,
      // rather than relying on Base.delete cascade
      await Sandbox.delete(sandbox.id, ncMeta);

      // Hard delete the sandbox base
      await Base.delete(sandboxContext, sandbox.sandbox_base_id, ncMeta);

      // Clear schema lock on master (one sandbox per base, so always clear)
      await Base.update(
        { ...context, base_id: sandbox.master_base_id },
        sandbox.master_base_id,
        { is_sandbox_master: false },
        ncMeta,
      );

      await ncMeta.commit();

      this.appHooksService.emit(AppEvents.SANDBOX_DELETE, {
        context,
        sandboxId: sandbox.id,
        baseId: sandbox.sandbox_base_id,
        req: _param.req,
      });

      return true;
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e);
      throw e;
    }
  }

  async sandboxCreate(
    context: NcContext,
    param: {
      baseId: string;
      user: { id: string; email: string };
      req: NcRequest;
      title?: string;
      description?: string;
      options?: {
        excludeData?: boolean;
      };
    },
  ): Promise<{ id: string; sandbox_base_id: string; job_id: string }> {
    const { baseId, user, req, title, description, options = {} } = param;

    // Validate base exists and is V3, not a sandbox, not a managed app install
    const base = await Base.get(context, baseId);
    if (!base) {
      NcError.get(context).baseNotFound(baseId);
    }
    if (base.is_sandbox) {
      NcError.get(context).badRequest(
        'Cannot create a sandbox from a sandbox base.',
      );
    }
    if (base.managed_app_id && !base.managed_app_master) {
      NcError.get(context).badRequest(
        'Cannot create a sandbox from a managed app instance.',
      );
    }
    if (base.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        'Sandbox is only supported for V3 bases.',
      );
    }

    // Enforce one sandbox per base
    const existingSandboxes = await Sandbox.listByMasterBaseId(baseId);
    if (existingSandboxes.length > 0) {
      NcError.get(context).badRequest(
        'Base already has a sandbox. Only one sandbox per base is allowed.',
      );
    }

    const baseSources = await base.getSources();

    // Use provided title or generate default
    const sandboxTitle = (title || `${base.title} (Sandbox)`)
      .trim()
      .substring(0, 50);

    const sandboxBase = await this.basesService.baseCreate({
      base: {
        title: sandboxTitle,
        type: 'database',
        ...{ fk_workspace_id: context.workspace_id },
        version: BaseVersion.V3,
        is_sandbox: true,
      },
      user: { id: req.user.id },
      req: req,
    });

    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      // Create sandbox record with optional description in meta
      const sandbox = await Sandbox.insert(
        context,
        {
          master_base_id: baseId,
          sandbox_base_id: sandboxBase.id,
          fk_workspace_id: context.workspace_id,
          created_by: user.id,
          meta: description ? { description } : undefined,
        },
        ncMeta,
      );
      // Update master base with is_sandbox_master flag
      await Base.update(context, baseId, { is_sandbox_master: true }, ncMeta);

      await ncMeta.commit();

      // Strip field-level permissions from the request so that the
      // duplication job can copy ALL data regardless of the initiating
      // user's field restrictions (sandbox creation is a system operation).
      const { permissions: _permissions, ...jobReq } = req as any;

      const job = await this.jobsService.add(JobTypes.DuplicateBase, {
        context,
        user,
        baseId: base.id,
        sourceId: baseSources[0]?.id,
        dupProjectId: sandboxBase.id,
        dupWorkspaceId: context.workspace_id,
        options: {
          excludeData: options.excludeData ?? false,
          excludeViews: false,
          excludeHooks: false,
          excludeScripts: false,
          excludeDashboards: false,
          excludeWorkflows: false,
          excludePersonalViews: true,
          excludePermissions: true,
          excludeRls: true,
          excludeDocuments: true,
        },
        req: jobReq,
      });

      this.appHooksService.emit(AppEvents.SANDBOX_CREATE, {
        context,
        sandboxId: sandbox.id,
        baseId: sandboxBase.id,
        req: param.req,
      });

      return {
        id: sandbox.id,
        sandbox_base_id: sandboxBase.id,
        job_id: `${job.id}`,
      };
    } catch (e) {
      await ncMeta.rollback();
      await Base.delete(
        { ...context, base_id: sandboxBase.id },
        sandboxBase.id,
      );
      this.logger.error(e);
      throw e;
    }
  }

  async sandboxDiscard(
    context: NcContext,
    _param: {
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<boolean> {
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', context.base_id);
    }

    const base = await Base.get(context, sandbox.sandbox_base_id);
    if (!base) {
      NcError.get(context).baseNotFound(sandbox.sandbox_base_id);
    }

    // Get the master base
    const masterBase = await Base.get(context, sandbox.master_base_id);
    if (!masterBase) {
      NcError.get(context).badRequest('Master base not found.');
    }

    // Get NcContext for master base
    const masterContext: NcContext = { ...context, base_id: masterBase.id };
    const sandboxContext: NcContext = {
      ...context,
      base_id: sandbox.sandbox_base_id,
    };

    // Get sources for master base
    const masterSources = await masterBase.getSources();
    const masterSourceId = masterSources?.[0]?.id;
    if (!masterSourceId) {
      NcError.get(context).badRequest('No sources found in master base.');
    }
    // Get sources for sandbox base
    const sandboxSources = await base.getSources();
    const sandboxSourceId = sandboxSources?.[0]?.id;
    if (!sandboxSourceId) {
      NcError.get(context).badRequest('No sources found in sandbox base.');
    }

    // Serialize metadata from both bases
    const masterMeta = await serializeMeta(masterContext, {
      override: {
        fk_workspace_id: sandboxContext.workspace_id,
        base_id: base.id,
        source_id: sandboxSourceId,
      },
      ...(masterBase.prefix
        ? {
            prefix: {
              old: masterBase.prefix,
              new: base.prefix || '',
            },
          }
        : {}),
    });
    const sandboxMeta = await serializeMeta(sandboxContext, {
      override: {
        fk_workspace_id: sandboxContext.workspace_id,
        base_id: base.id,
        source_id: sandboxSourceId,
      },
      ...(base.prefix
        ? {
            prefix: {
              old: base.prefix,
              new: base.prefix || '',
            },
          }
        : {}),
    });

    // Documents are treated as data — strip from both sides so discard does
    // not touch sandbox-owned docs.
    const diff = await diffMeta(
      stripDocuments(sandboxMeta),
      stripDocuments(masterMeta),
    );

    // Discard policy: preserve sandbox base variables — they are
    // environment-specific and should not be reverted to master values
    delete diff.add[MetaTable.BASE_VARIABLES];
    delete diff.update[MetaTable.BASE_VARIABLES];
    delete diff.delete[MetaTable.BASE_VARIABLES];

    // Apply the diff in a transaction to revert sandbox to master state
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      await applyMeta(sandboxContext, diff, ncMeta);
      await ncMeta.commit();
      // Clear cache AFTER commit — inside-transaction clears allow concurrent
      // requests to repopulate cache with stale pre-commit DB state.
      await NocoCache.clear(sandboxContext);

      // Clear changelog — sandbox reverted to master state, all prior changes void
      await SandboxChangelog.deleteBySandboxId(sandbox.id);

      this.appHooksService.emit(AppEvents.SANDBOX_DISCARD, {
        context,
        sandboxId: sandbox.id,
        baseId: sandbox.sandbox_base_id,
        req: _param.req,
      });

      // Notify all sandbox base users (including initiator) so UI refreshes
      NocoSocket.broadcastEventToBaseUsers(sandboxContext, {
        event: EventType.USER_EVENT,
        payload: {
          action: 'base_meta_reload',
          payload: {
            base_id: sandbox.sandbox_base_id,
          },
        },
      });

      return true;
    } catch (e) {
      await ncMeta.rollback();
      await NocoCache.clear(sandboxContext);
      this.logger.error(e);
      throw e;
    }
  }

  async sandboxMerge(
    context: NcContext,
    _param: {
      user: { id: string };
      req: NcRequest;
      selectedChangelogIds?: string[];
    },
  ): Promise<{ job_id: string }> {
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', context.base_id);
    }

    const base = await Base.get(context, sandbox.sandbox_base_id);
    if (!base) {
      NcError.get(context).baseNotFound(sandbox.sandbox_base_id);
    }

    const masterBase = await Base.get(context, sandbox.master_base_id);
    if (!masterBase) {
      NcError.get(context).badRequest('Master base not found.');
    }

    const job = await this.jobsService.add(JobTypes.SandboxMerge, {
      context,
      sandboxBaseId: sandbox.sandbox_base_id,
      masterBaseId: sandbox.master_base_id,
      sandboxId: sandbox.id,
      req: _param.req,
      selectedChangelogIds: _param.selectedChangelogIds,
    });

    return { job_id: `${job.id}` };
  }

  /**
   * Computes the schema diff between a sandbox and its master base.
   * Used for previewing changes before merge.
   */
  async sandboxChangelog(
    context: NcContext,
    param: {
      user: { id: string };
      req: NcRequest;
      excludeMerged?: boolean;
    },
  ) {
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', context.base_id);
    }

    // Default to true (UI lists pending entries); pass false to inspect merge
    // history (applied/skipped/failed). Accepts query param ?excludeMerged=false.
    const excludeMerged = param?.excludeMerged !== false;
    const changelog = await SandboxChangelog.listBySandboxId(sandbox.id, {
      excludeMerged,
    });

    // Batch-load user display info for avatar rendering in the UI
    const userIds = [
      ...new Set(changelog.map((c) => c.created_by).filter(Boolean)),
    ];
    let users: Record<
      string,
      { display_name: string; email: string; avatar: string | null }
    > = {};

    if (userIds.length > 0) {
      const knex = Noco.ncMeta.knex;
      const usersRaw = await knex('nc_users_v2')
        .whereIn('id', userIds)
        .select('id', 'display_name', 'email', 'avatar');

      users = Object.fromEntries(
        usersRaw.map((u: any) => [
          u.id,
          {
            display_name: u.display_name || u.email,
            email: u.email,
            avatar: u.avatar ?? null,
          },
        ]),
      );
    }

    return { changelog, users };
  }

  async sandboxDiff(
    context: NcContext,
    _param: {
      user: { id: string };
      req: NcRequest;
    },
  ) {
    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    if (!sandbox) {
      NcError._.genericNotFound('Sandbox', context.base_id);
    }

    const base = await Base.get(context, sandbox.sandbox_base_id);
    if (!base) {
      NcError.get(context).baseNotFound(sandbox.sandbox_base_id);
    }

    // Get the master base
    const masterBase = await Base.get(context, sandbox.master_base_id);
    if (!masterBase) {
      NcError.get(context).badRequest('Master base not found.');
    }
    // Get NcContext for master base
    const masterContext: NcContext = { ...context, base_id: masterBase.id };
    const sandboxContext: NcContext = { ...context, base_id: base.id };
    // Get sources for master base
    const masterSources = await masterBase.getSources();
    const masterSourceId = masterSources?.[0]?.id;
    if (!masterSourceId) {
      NcError.get(context).badRequest('No sources found in master base.');
    }
    // Get sources for sandbox base
    const sandboxSources = await base.getSources();
    const sandboxSourceId = sandboxSources?.[0]?.id;
    if (!sandboxSourceId) {
      NcError.get(context).badRequest('No sources found in sandbox base.');
    }
    // Serialize metadata from both bases
    const masterMeta = await serializeMeta(masterContext, {
      override: {
        fk_workspace_id: masterContext.workspace_id,
        base_id: masterBase.id,
        source_id: masterSourceId,
      },
      ...(masterBase.prefix
        ? {
            prefix: {
              old: masterBase.prefix,
              new: masterBase.prefix || '',
            },
          }
        : {}),
    });
    const sandboxMeta = await serializeMeta(sandboxContext, {
      override: {
        fk_workspace_id: masterContext.workspace_id,
        base_id: masterBase.id,
        source_id: masterSourceId,
      },
      ...(base.prefix
        ? {
            prefix: {
              old: base.prefix,
              new: masterBase.prefix || '',
            },
          }
        : {}),
    });
    // Documents are treated as data — exclude from the diff preview so
    // doc add/update/delete never appears as a schema change.
    const diff = await diffMeta(
      stripDocuments(masterMeta),
      stripDocuments(sandboxMeta),
    );

    // Variable diff policy: show new variables but hide value changes and deletions
    // (staging values are environment-specific and shouldn't appear in the diff preview)
    delete diff.update[MetaTable.BASE_VARIABLES];
    delete diff.delete[MetaTable.BASE_VARIABLES];

    // Dependency tracker is internal bookkeeping — hide from user-facing diff
    delete diff.add[MetaTable.DEPENDENCY_TRACKER];
    delete diff.update[MetaTable.DEPENDENCY_TRACKER];
    delete diff.delete[MetaTable.DEPENDENCY_TRACKER];

    // Include changelog for the UI
    const changelog = await SandboxChangelog.listBySandboxId(sandbox.id, {
      excludeMerged: true,
    });

    return { diff, changelog };
  }
}
