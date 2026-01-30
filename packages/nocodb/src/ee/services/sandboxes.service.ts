import { Inject, Injectable, Logger } from '@nestjs/common';
import { BaseVersion, NcBaseError } from 'nocodb-sdk';
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

  async sandboxGet(
    context: NcContext,
    param: { baseId: string },
  ): Promise<Sandbox | null> {
    const base = await Base.get(context, param.baseId);

    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    let sandbox: Sandbox | null = null;

    // If this base is a sandbox, get the sandbox record by sandbox_base_id
    if (base.is_sandbox) {
      sandbox = await Sandbox.getBySandboxBaseId(param.baseId);
    } else {
      // Otherwise, get sandbox for this master base
      sandbox = await Sandbox.getByMasterBaseId(param.baseId);
    }

    if (!sandbox) {
      return null;
    }

    return sandbox;
  }

  async sandboxCreate(
    context: NcContext,
    param: {
      baseId: string;
      user: { id: string; email: string };
      req: NcRequest;
      options?: {
        excludeData?: boolean;
      };
    },
  ): Promise<{ id: string; sandbox_base_id: string }> {
    const { baseId, user, req, options = {} } = param;

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
    // Check if base already has an active sandbox
    const existingSandbox = await Sandbox.getByMasterBaseId(baseId);
    if (existingSandbox) {
      NcError.get(context).badRequest(
        'Base already has an active sandbox. Delete the existing sandbox first.',
      );
    }

    const baseSources = await base.getSources();

    const sandboxBase = await this.basesService.baseCreate({
      base: {
        title: `${base.title} (Sandbox)`.trim().substring(0, 50),
        type: 'database',
        ...{ fk_workspace_id: context.workspace_id },
        version: BaseVersion.V3,
        is_sandbox: true,
      },
      user: { id: req.user.id },
      req: req,
    });

    const sandboxContext = {
      ...context,
      base_id: sandboxBase.id,
    };

    const ncMeta = await Noco.ncMeta.startTransaction();
    try {
      // Create sandbox record
      const sandbox = await Sandbox.insert(
        context,
        {
          master_base_id: baseId,
          sandbox_base_id: sandboxBase.id,
          fk_workspace_id: context.workspace_id,
          created_by: user.id,
        },
        ncMeta,
      );
      // Update master base with fk_sandbox_id
      await Base.update(context, baseId, { fk_sandbox_id: sandbox.id }, ncMeta);
      // Update sandbox base with fk_sandbox_id
      await Base.update(
        sandboxContext,
        sandboxBase.id,
        { fk_sandbox_id: sandbox.id },
        ncMeta,
      );

      await ncMeta.commit();

      await this.jobsService.add(JobTypes.DuplicateBase, {
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

      return { id: sandbox.id, sandbox_base_id: sandboxBase.id };
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
    param: {
      baseId: string;
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<boolean> {
    const { baseId } = param;

    const ncMeta = await Noco.ncMeta.startTransaction();

    try {
      const base = await Base.get(context, baseId, ncMeta);
      if (!base) {
        NcError.get(context).baseNotFound(baseId);
      }

      let sandbox;
      let masterBaseId;
      // If this base is a sandbox, get the sandbox record by sandbox_base_id
      if (base.is_sandbox) {
        sandbox = await Sandbox.getBySandboxBaseId(baseId, ncMeta);
        if (!sandbox) {
          NcError.get(context).badRequest(
            'No active sandbox found for this base.',
          );
        }
        masterBaseId = sandbox.master_base_id;
      } else {
        // Otherwise, get sandbox for this master base
        sandbox = await Sandbox.getByMasterBaseId(baseId, ncMeta);
        if (!sandbox) {
          NcError.get(context).badRequest(
            'No active sandbox found for this base.',
          );
        }
        masterBaseId = baseId;
      }

      const masterContext = {
        ...context,
        base_id: masterBaseId,
      };

      const sandboxContext = {
        ...context,
        base_id: sandbox.sandbox_base_id,
      };

      // Remove fk_sandbox_id from master base first
      await Base.update(
        masterContext,
        masterBaseId,
        { fk_sandbox_id: null },
        ncMeta,
      );

      // Hard delete the sandbox record
      await Sandbox.delete(sandbox.id, ncMeta);

      // Hard delete the sandbox base
      await Base.delete(sandboxContext, sandbox.sandbox_base_id, ncMeta);

      await ncMeta.commit();

      /* this.appHooksService.emit(AppEvents.SANDBOX_DISCARD, {
        sandbox,
        masterBase: base,
        user,
        req,
        context,
      }); */

      return true;
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e);
      throw e;
    }
  }

  async sandboxMerge(
    context: NcContext,
    param: {
      baseId: string;
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<boolean> {
    const { baseId } = param;

    const base = await Base.get(context, baseId);
    if (!base) {
      NcError.get(context).baseNotFound(baseId);
    }
    if (!base.is_sandbox) {
      NcError.get(context).badRequest('This base is not a sandbox.');
    }
    // Get the sandbox record
    const sandbox = await Sandbox.getBySandboxBaseId(baseId);
    if (!sandbox) {
      NcError.get(context).badRequest('Sandbox record not found.');
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
    param: {
      baseId: string;
      user: { id: string };
      req: NcRequest;
    },
  ): Promise<BaseMetaDiff> {
    const { baseId } = param;
    const base = await Base.get(context, baseId);
    if (!base) {
      NcError.get(context).baseNotFound(baseId);
    }
    if (!base.is_sandbox) {
      NcError.get(context).badRequest('This base is not a sandbox.');
    }
    // Get the sandbox record
    const sandbox = await Sandbox.getBySandboxBaseId(baseId);
    if (!sandbox) {
      NcError.get(context).badRequest('Sandbox record not found.');
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
