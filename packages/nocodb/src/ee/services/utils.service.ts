import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { useAgent } from 'request-filtering-agent';
import { UtilsService as UtilsServiceCE } from 'src/services/utils.service';
import type { AppConfig } from '~/interface/config';
import SSOClient from '~/models/SSOClient';

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
  constructor(protected readonly configService: ConfigService<AppConfig>) {
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
      httpAgent: useAgent(apiMeta.url, {
        stopPortScanningByUrlRedirection: true,
      }),
      httpsAgent: useAgent(apiMeta.url, {
        stopPortScanningByUrlRedirection: true,
      }),
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
    const isExcelImport = /.*\.(xls|xlsx|xlsm|ods|ots)/;
    const isCSVImport = /.*\.(csv)/;
    const ipBlockList =
      /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g;
    if (
      ipBlockList.test(url) ||
      (!isCSVImport.test(url) && !isExcelImport.test(url))
    ) {
      return {};
    }
    if (isCSVImport || isExcelImport) {
      param.body.apiMeta.responseType = 'arraybuffer';
    }
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

  async appInfo(param: { req: { ncSiteUrl: string; user?: any } }) {
    const result: any = await super.appInfo(param);

    // get sso clients and extract id, url and display name
    const ssoClients = await SSOClient.getPublicList({
      ncSiteUrl: param.req.ncSiteUrl,
    });

    // in cloud decide telemetry enabled or not based on PostHog API key presence
    result.teleEnabled = !!process.env.NC_CLOUD_POSTHOG_API_KEY;

    const cognitoConfig = this.configService.get('cognito', {
      infer: true,
    });

    result.cognito = cognitoConfig;
    result.ssoClients = ssoClients;

    return result;
  }
}
