import { Injectable } from '@nestjs/common';
import { CloudOrgUserRoles, type DomainReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { DbServer, Domain, Org, OrgUser, PresignedUrl, User } from '~/models';
import { NcError } from '~/helpers/catchError';
import { generateRandomTxt, verifyTXTRecord } from '~/utils';

@Injectable()
export class OrgsService {
  async createOrg(param: {
    title: string;
    userId: string;
    dbServerId?: string;
    req?: NcRequest;
  }) {
    const user = await User.get(param.userId);

    if (!user) {
      NcError.userNotFound(param.userId);
    }

    if (param.dbServerId) {
      const dbServer = await DbServer.get(param.dbServerId);

      if (!dbServer) {
        NcError.genericNotFound('DB Server', param.dbServerId);
      }
    }

    const org = await Org.insert({
      title: param.title,
      fk_user_id: user.id,
      fk_db_instance_id: param.dbServerId,
    });

    // assign org role
    await OrgUser.insert({
      fk_user_id: user.id,
      fk_org_id: org.id,
      roles: CloudOrgUserRoles.OWNER,
    });

    return org;
  }

  // add workspace
  addWorkspace(_param: { user: any; workspaceId: string; req: NcRequest }) {
    // return this.orgService.
  }

  // update workspace
  updateWorkspace(_param: { user: any; workspaceId: string; req: NcRequest }) {
    return Promise.resolve(undefined);
  }

  // delete workspace
  deleteWorkspace(_param: { user: any; workspaceId: string; req: NcRequest }) {
    return Promise.resolve(undefined);
  }

  async verifyDomain(param: { domainId: string; req: any }) {
    const domain = await Domain.get(param.domainId);

    if (!domain) {
      NcError.notFound('Domain not found');
    }

    const verified = await verifyTXTRecord(domain.domain, domain.txt_value);

    if (domain.verified !== verified) {
      await Domain.update(param.domainId, {
        verified,
      });

      // on successful verification, remove any existing domain entry with the same domain
      if (verified) {
        await Domain.deleteDuplicateDomain(domain.domain, domain.id);
      }
    }

    return verified;
  }

  async domainList(param: {
    orgId?: string;
    req: NcRequest;
    workspaceId?: string;
  }) {
    const domainList = await Domain.list({
      orgId: param.orgId,
      workspaceId: param.workspaceId,
    });

    return domainList;
  }

  async addDomain(param: {
    body: DomainReqType;
    workspaceId?: string;
    orgId?: string;
    req: NcRequest;
  }) {
    // todo: validate and verify

    // generate a txt value
    const txtValue = generateRandomTxt();

    // restrict if an already verified domain exists
    const existingDomain = await Domain.getByDomain(param.body.domain);
    if (existingDomain) {
      NcError.badRequest(
        'Domain not available, please try another domain or contact support',
      );
    }

    const domain = await Domain.insert({
      deleted: param.body.deleted,
      domain: param.body.domain,
      txt_value: txtValue,
      fk_org_id: param.orgId,
      fk_workspace_id: param.workspaceId,
      fk_user_id: param.req.user?.id,
    });

    await this.verifyDomain({ domainId: domain.id, req: param.req });

    return domain;
  }

  async updateDomain(param: {
    domain: DomainReqType;
    domainId: string;
    req: NcRequest;
  }) {
    const updateObject: any = {
      domain: param.domain.domain,
      deleted: false,
    };

    if (param.domain) {
      updateObject.verified = await this.verifyDomain({
        domainId: param.domainId,
        req: param.req,
      });
    }

    const res = await Domain.update(param.domainId, updateObject);

    await this.verifyDomain({ domainId: param.domainId, req: param.req });

    return res;
  }

  async updateOrg(param: {
    orgId: string;
    org: any;
    user: User;
    req: NcRequest;
  }) {
    return await Org.update(param.orgId, param.org);
  }

  async readOrg(param: { orgId: string; user: User; req: NcRequest }) {
    const org = await Org.get(param.orgId);

    await PresignedUrl.signMetaIconImage(org);
    return org;
  }

  async baseList(param: { orgId: string; req: NcRequest }) {
    return await Org.baseList(param.orgId);
  }
}
