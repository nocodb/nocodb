import type { DeploymentStatus, DeploymentType } from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import {
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';

export default class SandboxDeploymentLog {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  fk_sandbox_id: string;

  from_version_id?: string;
  to_version_id: string;

  status: DeploymentStatus;
  deployment_type: DeploymentType;

  error_message?: string;
  deployment_log?: string;
  meta?: Record<string, any> | string;

  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;

  constructor(log: Partial<SandboxDeploymentLog>) {
    Object.assign(this, log);
  }

  public static async get(
    logId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxDeploymentLog> {
    const cacheKey = `${CacheScope.SANDBOX_DEPLOYMENT_LOG}:${logId}`;

    let log = await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT);

    if (!log) {
      log = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SANDBOX_DEPLOYMENT_LOGS,
        logId,
      );

      if (!log) return null;

      log = prepareForResponse(log);

      await NocoCache.set('root', cacheKey, log);
    }

    return log && new SandboxDeploymentLog(log);
  }

  public static async list(
    baseId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxDeploymentLog[]> {
    const logs = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_DEPLOYMENT_LOGS,
      {
        condition: {
          base_id: baseId,
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    return logs?.map((log) => {
      return new SandboxDeploymentLog(prepareForResponse(log));
    });
  }

  public static async listBySandbox(
    sandboxId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxDeploymentLog[]> {
    const logs = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_DEPLOYMENT_LOGS,
      {
        condition: {
          fk_sandbox_id: sandboxId,
        },
        orderBy: {
          created_at: 'desc',
        },
      },
    );

    return logs?.map((log) => {
      return new SandboxDeploymentLog(prepareForResponse(log));
    });
  }

  public static async insert(
    log: Partial<SandboxDeploymentLog>,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxDeploymentLog> {
    const insertObj = extractProps(log, [
      'id',
      'fk_workspace_id',
      'base_id',
      'fk_sandbox_id',
      'from_version_id',
      'to_version_id',
      'status',
      'deployment_type',
      'error_message',
      'deployment_log',
      'meta',
      'started_at',
      'completed_at',
    ]);

    if (insertObj.meta && typeof insertObj.meta === 'object') {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_DEPLOYMENT_LOGS,
      prepareForDb(insertObj),
    );

    return await this.get(id, ncMeta);
  }

  public static async update(
    logId: string,
    log: Partial<SandboxDeploymentLog>,
    ncMeta = Noco.ncMeta,
  ): Promise<SandboxDeploymentLog> {
    const updateObj = extractProps(log, [
      'status',
      'error_message',
      'deployment_log',
      'meta',
      'started_at',
      'completed_at',
    ]);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SANDBOX_DEPLOYMENT_LOGS,
      prepareForDb(updateObj),
      logId,
    );

    const cacheKey = `${CacheScope.SANDBOX_DEPLOYMENT_LOG}:${logId}`;
    await NocoCache.del('root', cacheKey);

    return await this.get(logId, ncMeta);
  }
}
