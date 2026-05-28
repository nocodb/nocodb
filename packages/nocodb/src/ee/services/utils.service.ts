import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { getCircularReplacer, OperationSource } from 'nocodb-sdk';
import { UtilsService as UtilsServiceCE } from 'src/services/utils.service';
import type { AppConfig, NcRequest } from '~/interface/config';
import { getFilteredAgents } from '~/utils/ssrf';
import { isDocsRealtimeEnabled } from '~/helpers/dbHelpers';
import { EEOnly } from '~/decorators/ee-only.decorator';
import SSOClient from '~/models/SSOClient';
import { CacheGetType, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { WhiteLabelService } from '~/services/white-label.service';

interface ViewCount {
  formCount: number | null;
  gridCount: number | null;
  galleryCount: number | null;
  kanbanCount: number | null;
  total: number | null;
  sharedFormCount: number | null;
  sharedGridCount: number | null;
  sharedGalleryCount: number | null;
  sharedKanbanCount: number | null;
  sharedTotal: number | null;
  sharedLockedCount: number | null;
}

export interface AllMeta {
  baseCount: number;
  bases: (
    | {
        external?: boolean | null;
        tableCount: {
          table: number;
          view: number;
        } | null;
        viewCount: ViewCount;
        webhookCount: number | null;
        filterCount: number | null;
        sortCount: number | null;
        rowCount: ({ totalRecords: number } | null)[] | null;
        userCount: number | null;
      }
    | { error: string }
  )[];
  userCount: number;
  sharedBaseCount: number;
}

@Injectable()
export class UtilsService extends UtilsServiceCE {
  constructor(
    protected readonly configService: ConfigService<AppConfig>,
    protected readonly whiteLabelService: WhiteLabelService,
  ) {
    super(configService);
  }

  async _axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const { apiMeta } = param.body;

    if (apiMeta?.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body);
      } catch (e) {
        console.log(e);
      }
    }

    if (apiMeta?.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth);
      } catch (e) {
        console.log(e);
      }
    }

    apiMeta.response = {};
    const _req = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = param.value;
            }
            return paramsObj;
          }, {})
        : {},
      url: apiMeta.url,
      method: apiMeta.method || 'GET',
      data: apiMeta.body || {},
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = header.value;
            }
            return headersObj;
          }, {})
        : {},
      responseType: apiMeta.responseType || 'json',
      withCredentials: true,
      ...getFilteredAgents({ url: apiMeta.url, source: OperationSource.HOOKS }),
    };
    const data = await axios(_req);
    return data?.data;
  }

  async axiosRequestMake(param: {
    body: {
      apiMeta: any;
    };
  }) {
    const {
      apiMeta: { url },
    } = param.body;
    // Test the extension against the URL's pathname only, so callers can't
    // smuggle a non-spreadsheet target by appending `?.csv` to the query
    // string. useAgent in _axiosRequestMake handles SSRF at the socket.
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return {};
    }
    const isExcelImport = /\.(xls|xlsx|xlsm|ods|ots)$/i;
    const isCSVImport = /\.(csv)$/i;
    if (!isCSVImport.test(pathname) && !isExcelImport.test(pathname)) {
      return {};
    }
    param.body.apiMeta.responseType = 'arraybuffer';
    return await this._axiosRequestMake({
      body: param.body,
    });
  }

  extractResultOrNull = (results: PromiseSettledResult<any>[]) => {
    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      console.log(result.reason);
      return null;
    });
  };

  @EEOnly()
  async appInfo(param: { req: { ncSiteUrl: string; user?: any } }) {
    const result: any = await super.appInfo(param);

    // get sso clients and extract id, url and display name
    const ssoClients = await SSOClient.getPublicList({
      ncSiteUrl: param.req.ncSiteUrl,
    });

    // in cloud decide telemetry enabled or not based on PostHog API key presence
    result.teleEnabled = !!process.env.NC_CLOUD_POSTHOG_API_KEY;

    // if OpenReplay key is present, include it in the result
    if (process.env.NC_OPENREPLAY_KEY) {
      result.openReplayKey = process.env.NC_OPENREPLAY_KEY;
    }

    const cognitoConfig = this.configService.get('cognito', {
      infer: true,
    });

    result.cognito = cognitoConfig;
    result.ssoClients = ssoClients;

    if (process.env.NC_STRIPE_SECRET_KEY) {
      result.stripePublishableKey = process.env.NC_STRIPE_PUBLISHABLE_KEY;
    }

    result.marketingRootUrl =
      process.env.NC_MARKETING_ROOT_URL || 'https://nocodb.com';

    result.templatesRootUrl =
      process.env.NC_TEMPLATES_ROOT_URL || 'https://nocodb.com';

    result.sendRecordMaxRecipients = parseInt(
      process.env.NC_SEND_RECORD_MAX_RECIPIENTS || '15',
      10,
    );

    // Map provider configuration for tile rendering
    result.mapProvider = process.env.NC_MAP_TILE_PROVIDER || 'openstreetmap';

    // Yjs realtime co-editing of docs. Off → the frontend falls back to the
    // legacy debounced REST save (NC_DOCS_REALTIME=false kill-switch).
    result.docsRealtimeEnabled = isDocsRealtimeEnabled();

    // White-label config — sanitized (null when disabled or unconfigured)
    result.whiteLabel = await this.whiteLabelService.getPublicConfig();

    return result;
  }

  async templates(req: NcRequest) {
    const {
      industry,
      usecase,
      search,
      page = 1,
      per_page = 25,
    } = req.query as {
      industry: string;
      usecase: string;
      search: string;
      page: string;
      per_page: string;
    };

    const key = `${CacheScope.TEMPLATES}:${industry}:${usecase}:${search}:${page}:${per_page}`;

    const cachedData = await NocoCache.get(
      'root',
      key,
      CacheGetType.TYPE_ARRAY,
    );

    if (cachedData?.length) {
      return cachedData;
    }

    let response;
    try {
      response = await axios.get('https://nocodb.com/api/v1/cloud/templates', {
        params: {
          industry,
          usecase,
          search,
          page,
          per_page,
        },
      });
    } catch (e) {
      this.logger.error(e?.message, e);
      return [];
    }

    await NocoCache.setExpiring(
      'root',
      key,
      JSON.stringify(response.data, getCircularReplacer),
      2 * 60 * 60,
    );

    return response.data;
  }

  async template(req: NcRequest) {
    const { id } = req.query as {
      id: string;
    };

    const key = `${CacheScope.TEMPLATES}:record:${id}`;

    const cachedData = await NocoCache.get(
      'root',
      key,
      CacheGetType.TYPE_OBJECT,
    );

    if (cachedData) {
      return cachedData;
    }

    let response;
    try {
      response = await axios.get('https://nocodb.com/api/v1/cloud/templates', {
        params: {
          id,
        },
      });
    } catch (e) {
      this.logger.error(e?.message, e);
      return null;
    }

    await NocoCache.setExpiring(
      'root',
      key,
      JSON.stringify(response.data, getCircularReplacer),
      2 * 60 * 60,
    );

    return response.data;
  }
}
