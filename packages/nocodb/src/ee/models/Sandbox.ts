import { BaseVersion } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import NocoCache from '~/cache/NocoCache';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';
import { Base } from '~/models';

export enum SandboxStatus {
  PUBLISHED = 'published',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

export enum SandboxVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
}

export default class Sandbox {
  id: string;
  base_id: string;
  fk_workspace_id: string;

  title: string;
  description?: string;

  // Owner of the sandbox app
  created_by: string;

  // Sandbox status
  status: SandboxStatus;

  // Visibility in app store
  visibility: SandboxVisibility;

  // Version information
  version: string;

  // Category for filtering in app store
  category?: string;

  // Installation/usage stats
  install_count: number;

  // Metadata (screenshots, documentation, etc.)
  meta?: Record<string, any> | string;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;

  constructor(sandbox: Partial<Sandbox>) {
    Object.assign(this, sandbox);
  }

  public static async get(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    let sandbox = await NocoCache.get(
      context,
      `${CacheScope.SANDBOX}:${sandboxId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!sandbox) {
      // Use RootScopes.ROOT for global scope query with workspace filtering via xcCondition
      sandbox = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SANDBOXES,
        sandboxId,
        null,
        {
          _and: [
            {
              fk_workspace_id: {
                eq: context.workspace_id,
              },
            },
          ],
        },
      );

      if (!sandbox) return null;

      sandbox = prepareForResponse(sandbox);

      await NocoCache.set(
        context,
        `${CacheScope.SANDBOX}:${sandboxId}`,
        sandbox,
      );
    }

    return new Sandbox(sandbox);
  }

  public static async getByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const sandboxes = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition: {
          _and: [
            { base_id: { eq: baseId } },
            { fk_workspace_id: { eq: context.workspace_id } },
          ],
        },
      },
    );

    if (!sandboxes || sandboxes.length === 0) return null;

    return new Sandbox(prepareForResponse(sandboxes[0]));
  }

  public static async list(
    context: NcContext,
    args?: {
      workspaceId?: string;
      userId?: string;
      status?: SandboxStatus;
      visibility?: SandboxVisibility;
      category?: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox[]> {
    const conditions: any[] = [
      { fk_workspace_id: { eq: args?.workspaceId || context.workspace_id } },
    ];

    if (args?.userId) {
      conditions.push({ created_by: { eq: args.userId } });
    }

    if (args?.status) {
      conditions.push({ status: { eq: args.status } });
    }

    if (args?.visibility) {
      conditions.push({ visibility: { eq: args.visibility } });
    }

    if (args?.category) {
      conditions.push({ category: { eq: args.category } });
    }

    const sandboxList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition: {
          _and: conditions,
        },
        limit: args?.limit,
        offset: args?.offset,
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    return sandboxList.map(
      (sandbox) => new Sandbox(prepareForResponse(sandbox)),
    );
  }

  public static async listPublished(
    context: NcContext,
    args?: {
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox[]> {
    const xcCondition: any = {
      _and: [
        { status: { eq: SandboxStatus.PUBLISHED } },
        { fk_workspace_id: { eq: context.workspace_id } },
      ],
    };

    // For now, only list sandboxes from the same workspace (private/internal)
    // Later we can add visibility: PUBLIC for cross-workspace sharing

    if (args?.category) {
      xcCondition._and.push({ category: { eq: args.category } });
    }

    if (args?.search) {
      xcCondition._and.push({
        _or: [
          { title: { like: `%${args.search}%` } },
          { description: { like: `%${args.search}%` } },
        ],
      });
    }

    // Use RootScopes.ROOT for global scope query
    const sandboxList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        xcCondition,
        limit: args?.limit,
        offset: args?.offset,
        orderBy: {
          install_count: 'desc',
          created_at: 'desc',
        },
      },
    );

    return sandboxList.map(
      (sandbox) => new Sandbox(prepareForResponse(sandbox)),
    );
  }

  public static async insert(
    context: NcContext,
    sandbox: Partial<Sandbox>,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    // Validate base exists and is V3
    const base = await Base.get(context, sandbox.base_id);
    if (!base) {
      NcError.get(context).baseNotFound(sandbox.base_id);
    }

    if (base.version !== BaseVersion.V3) {
      NcError.get(context).badRequest(
        `Only V3 bases can be published as sandbox apps`,
      );
    }

    const insertObj = extractProps(sandbox, [
      'title',
      'description',
      'base_id',
      'created_by',
      'fk_workspace_id',
      'status',
      'visibility',
      'version',
      'category',
      'meta',
    ]);

    // Set defaults
    insertObj.status = insertObj.status || SandboxStatus.DRAFT;
    insertObj.visibility = insertObj.visibility || SandboxVisibility.PRIVATE;
    insertObj.version = insertObj.version || '1.0.0';
    insertObj.install_count = 0;

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      prepareForDb(insertObj),
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    sandboxId: string,
    sandbox: Partial<Sandbox>,
    ncMeta = Noco.ncMeta,
  ): Promise<Sandbox> {
    const updateObj = extractProps(sandbox, [
      'title',
      'description',
      'status',
      'visibility',
      'version',
      'category',
      'meta',
      'published_at',
    ]);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    // Auto-update published_at when status changes to published
    if (
      updateObj.status === SandboxStatus.PUBLISHED &&
      !updateObj.published_at
    ) {
      updateObj.published_at = new Date().toISOString();
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      prepareForDb(updateObj),
      sandboxId,
    );

    await NocoCache.del(context, `${CacheScope.SANDBOX}:${sandboxId}`);

    return this.get(context, sandboxId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      sandboxId,
    );

    await NocoCache.del(context, `${CacheScope.SANDBOX}:${sandboxId}`);

    return true;
  }

  public static async incrementInstallCount(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        install_count: ncMeta.knex.raw('install_count + 1'),
      },
      sandboxId,
    );

    await NocoCache.del(context, `${CacheScope.SANDBOX}:${sandboxId}`);
  }

  public static async incrementVersion(
    context: NcContext,
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const sandbox = await this.get(context, sandboxId);

    if (!sandbox) {
      throw new Error('Sandbox not found');
    }

    // Parse current version and increment
    const currentVersion = sandbox.version || '1.0.0';
    const versionParts = currentVersion.split('.');
    const major = parseInt(versionParts[0] || '1', 10);
    const minor = parseInt(versionParts[1] || '0', 10);
    const patch = parseInt(versionParts[2] || '0', 10);

    // Increment minor version for updates
    const newVersion = `${major}.${minor + 1}.0`;

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOXES,
      {
        version: newVersion,
      },
      sandboxId,
    );

    await NocoCache.del(context, `${CacheScope.SANDBOX}:${sandboxId}`);
  }

  public async getBase(context: NcContext): Promise<Base> {
    return await Base.get(context, this.base_id);
  }
}
