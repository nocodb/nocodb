import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseVersion } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Base, Sandbox } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
// import { JobTypes } from '~/interface/Jobs';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import {
  applyMeta,
  type BaseMetaDiff,
  diffMeta,
  serializeMeta,
} from '~/helpers/baseMetaHelpers';
import { JobTypes } from '~/interface/Jobs';

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

    const sandbox = await Sandbox.getBySandboxBaseId(context.base_id);
    return sandbox ?? null;
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

      // Hard delete the sandbox base
      await Base.delete(sandboxContext, sandbox.sandbox_base_id, ncMeta);

      await ncMeta.commit();

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
        },
        req,
      });

      return {
        id: sandbox.id,
        sandbox_base_id: sandboxBase.id,
        job_id: `${job.id}`,
      };
    } catch (e) {
      await ncMeta.rollback();
      await this.basesService.baseSoftDelete(
        {
          ...context,
          base_id: sandboxBase.id,
        },
        {
          baseId: sandboxBase.id,
          user: user as any,
          req,
        },
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

    // Calculate diff (sandbox is current, master is target - we want to revert to master)
    const diff = await diffMeta(sandboxMeta, masterMeta);

    // Apply the diff in a transaction to revert sandbox to master state
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      await applyMeta(sandboxContext, diff, ncMeta);
      await ncMeta.commit();
      return true;
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e);
      throw e;
    }
  }

  async sandboxMerge(
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

    // Calculate diff (master is current, sandbox is new)
    const diff = await diffMeta(masterMeta, sandboxMeta);

    // Apply the diff in a transaction
    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      await applyMeta(masterContext, diff, ncMeta);
      await ncMeta.commit();
      return true;
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e);
      throw e;
    }
  }

  /**
   * Computes the schema diff between a sandbox and its master base.
   * Used for previewing changes before merge.
   */
  async sandboxDiff(
    context: NcContext,
    _param: {
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<BaseMetaDiff> {
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
    // Calculate diff (master is current, sandbox is new)
    const diff = await diffMeta(masterMeta, sandboxMeta);
    return diff;
  }
}
