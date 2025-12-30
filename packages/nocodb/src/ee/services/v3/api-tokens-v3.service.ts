import { Injectable, Logger } from '@nestjs/common';
import { NcApiVersion, type NcRequest } from 'nocodb-sdk';
import type {
  ApiTokensV3CreateRequest,
  ApiTokensV3ListResponse,
  ApiTokensV3WithToken,
} from '~/services/v3/api-tokens-v3.type';
import {
  type ApiV3DataTransformationBuilder,
  builderGenerator,
} from '~/utils/api-v3-data-transformation.builder';
import { OrgTokensService } from '~/services/org-tokens.service';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { WorkspacesService } from '~/services/workspaces.service';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ApiTokensV3Service {
  protected readonly logger = new Logger(ApiTokensV3Service.name);
  protected builder: () => ApiV3DataTransformationBuilder<any, Partial<any>>;

  constructor(
    private readonly orgTokensService: OrgTokensService,
    private readonly orgTokensEeService: OrgTokensEeService,
    private readonly workspaceService: WorkspacesService,
  ) {
    this.builder = builderGenerator({
      allowed: ['id', 'token', 'description', 'created_at', 'updated_at'],
      mappings: {
        description: 'title',
      },
      transformFn(data) {
        return data;
      },
    });
  }

  async validateRequestor(param: { cookie: NcRequest }) {
    // requestor must has enterprise workspace
    const result = await this.workspaceService.list({
      user: param.cookie.user,
      req: param.cookie,
    });
    if (!result.list.some((ws) => !!ws.fk_org_id)) {
      NcError.get({ api_version: NcApiVersion.V3 }).forbidden(
        `Accessing api token api require enterprise plan`,
      );
    }
  }

  async list(param: { cookie: NcRequest }) {
    await this.validateRequestor(param);
    const result = await this.orgTokensEeService.apiTokenListEE({
      query: param.cookie.query,
      user: param.cookie['user'],
    });
    return {
      list: this.builder()
        .build(result.list)
        .map((apiT) => {
          const { token: _token, ...v3ApiToken } = apiT;
          return v3ApiToken;
        }),
    } as ApiTokensV3ListResponse;
  }

  async create(param: { cookie: NcRequest; body: ApiTokensV3CreateRequest }) {
    await this.validateRequestor(param);
    const result = await this.orgTokensService.apiTokenCreate({
      apiToken: { description: param.body.title },
      user: param.cookie['user'],
      req: param.cookie,
    });
    return this.builder().build(result) as ApiTokensV3WithToken;
  }

  async delete(param: { id: string; cookie: NcRequest }) {
    await this.validateRequestor(param);
    const result = await this.orgTokensService.apiTokenDelete({
      tokenId: param.id,
      user: param.cookie['user'],
      req: param.cookie,
    });
    return this.builder().build(result);
  }
}
