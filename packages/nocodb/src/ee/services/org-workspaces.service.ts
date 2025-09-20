import { Injectable } from '@nestjs/common';
import {
  CloudOrgUserRoles,
  ncIsArray,
  parseProp,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import Noco from 'src/ee/Noco';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { User } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { parseMetaProp } from '~/utils/modelUtils';
import { OrgUser, PresignedUrl, Workspace, WorkspaceUser } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import Org from '~/models/Org';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, MetaTable } from '~/utils/globals';
import { NocoJobsService } from '~/services/noco-jobs.service';

const IS_UPGRADE_ALLOWED_CACHE_KEY = 'nc_upgrade_allowed';

@Injectable()
export class OrgWorkspacesService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
  ) {}

  async listWorkspaces(param: {
    user: UserType | User;
    orgId: string;
    req: NcRequest;
  }) {
    let wsList = await Workspace.listByOrgId({
      orgId: param.orgId,
    });

    wsList = Promise.all(
      wsList.map(async (ws) => {
        ws.meta = parseMetaProp(ws);

        await PresignedUrl.signMetaIconImage(ws);

        if (!ncIsArray(ws?.members)) return ws;

        if (ncIsArray(ws?.members)) {
          ws.members = await Promise.all(
            ws.members.map(async (member) => {
              member = parseProp(member);

              member.meta = parseMetaProp(member);

              await PresignedUrl.signMetaIconImage(member);

              return member;
            }),
          );
        }

        if (ncIsArray(ws?.bases)) {
          ws.bases = await Promise.all(
            ws.bases.map(async (base) => {
              return parseProp(base);
            }),
          );
        }

        return ws;
      }),
    );

    return wsList;
  }

  async upgradeWorkspace(param: {
    user: any;
    workspaceId: string;
    req: NcRequest;
    orgId?: string;
  }) {
    await this.isOrgUpgradeAllowed(param);

    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) {
      NcError.notFound('Workspace not found');
    }

    let org;

    // check if orgId is present and if it is, then move the workspace to the org
    if (param.orgId) {
      org = await Org.get(param.orgId);

      if (!org) {
        NcError.notFound('Org not found');
      }

      // check org user table and validate the permission
      if (org.fk_user_id !== param.user.id) {
        NcError.unauthorized('You are not authorized to perform this action');
      }
    } else {
      // check if the user owns an existing org
      const ownedOrgs = await OrgUser.getOwnedOrgs(param.user?.id);

      if (ownedOrgs?.length > 0) {
        org = await Org.get(ownedOrgs[0].fk_org_id);
      } else {
        // create a new org
        org = await Org.insert({
          title: 'Organization Name',
          fk_user_id: param.user.id,
        });
        // assign org role
        await OrgUser.insert({
          fk_user_id: param.user.id,
          fk_org_id: org.id,
          roles: CloudOrgUserRoles.OWNER,
        });
      }
    }

    // update the organization id in the workspace

    await Workspace.updateOrgId({
      id: param.workspaceId,
      orgId: org.id,
    });

    await this.nocoJobsService.add(JobTypes.CloudDbMigrate, {
      workspaceOrOrgId: param.workspaceId,
      conditions: {
        fk_org_id: org.id,
      },
      targetOrgId: org.id,
      oldDbServerId: workspace.fk_db_instance_id,
    });

    return org;
  }

  async addWorkspaceToOrg(param: {
    user: any;
    workspaceId: string;
    req: NcRequest;
    orgId: string;
  }) {
    // todo: do the necessary checks

    const org = await Org.get(param.orgId);

    if (!org) {
      NcError.notFound('Org not found');
    }

    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) {
      NcError.notFound('Workspace not found');
    }

    // check org user table and validate the permission
    const orgUser = await OrgUser.get(param.orgId, param.user.id);

    if (orgUser.roles !== CloudOrgUserRoles.OWNER) {
      NcError.forbidden('You are not the owner of the organization');
    }

    // check user is workspace owner or not
    const workspaceOwner = await WorkspaceUser.get(
      param.workspaceId,
      param.user.id,
    );

    if (!workspaceOwner || workspaceOwner.roles !== WorkspaceUserRoles.OWNER) {
      NcError.forbidden('You are not the owner of the workspace');
    }

    // update the organization id in the workspace
    await Workspace.updateOrgId({
      id: param.workspaceId,
      orgId: org.id,
    });

    return true;
  }

  async removeWorkspaceFromOrg(param: {
    user: any;
    workspaceId: string;
    req: Request;
    orgId: string;
  }) {
    // todo: do the necessary checks

    const org = await Org.get(param.orgId);

    if (!org) {
      NcError.notFound('Org not found');
    }

    const workspace = await Workspace.get(param.workspaceId);

    if (!workspace) {
      NcError.notFound('Workspace not found');
    }

    if (workspace.fk_org_id !== org.id) {
      NcError.notFound('Workspace not found in the organization');
    }

    // check org user table and validate the permission
    if (org.fk_user_id !== param.user.id) {
      NcError.unauthorized('You are not authorized to perform this action');
    }

    // update the organization id in the workspace
    await Workspace.updateOrgId({
      id: param.workspaceId,
      orgId: null,
    });

    return true;
  }

  updateWorkspace(_param: {
    user: UserType | User;
    workspaceId: string;
    req: NcRequest;
  }) {
    return Promise.resolve(undefined);
  }

  deleteWorkspace(_param: {
    user: UserType | User;
    workspaceId: string;
    req: NcRequest;
  }) {
    return Promise.resolve(undefined);
  }

  // temporary workaround based on cache to enable disable org upgrade
  private async isOrgUpgradeAllowed(param: { user: any }) {
    // skip the check for test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const cacheVal = await NocoCache.get(
      'root',
      IS_UPGRADE_ALLOWED_CACHE_KEY,
      CacheGetType.TYPE_STRING,
    );

    let isAllowed = cacheVal
      ?.trim?.()
      .split(/\s*,\s*/)
      .includes((param as any).user?.email);

    // TODO: remove this temporary check : if user owner of any org, then add upgradeOrg to featureFlags
    const orgOwners = await NocoCache.get(
      'root',
      `orgOwners`,
      CacheGetType.TYPE_STRING,
    );
    if (!orgOwners) {
      const orgOwners = await Noco.ncMeta.knexConnection
        .select('fk_user_id')
        .from(MetaTable.ORG_USERS)
        .where('roles', CloudOrgUserRoles.OWNER);

      await NocoCache.set(
        'root',
        `orgOwners`,
        orgOwners.map((o) => o.fk_user_id).join(','),
      );
    }

    if (orgOwners?.includes((param as any).user?.id)) {
      isAllowed = true;
    }

    if (!isAllowed) {
      NcError.forbidden(
        'Upgrade not allowed, please contact NocoDB support team',
      );
    }
  }
}
