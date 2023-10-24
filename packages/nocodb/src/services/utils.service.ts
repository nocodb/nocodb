import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { compareVersions, validate } from 'compare-versions';
import { ViewTypes } from 'nocodb-sdk';
import { ConfigService } from '@nestjs/config';
import { useAgent } from 'request-filtering-agent';
import type { AppConfig } from '~/interface/config';
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';
import SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import { NcError } from '~/helpers/catchError';
import { Base, User } from '~/models';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { MetaTable } from '~/utils/globals';
import { jdbcToXcConfig } from '~/utils/nc-config/helpers';
import { packageVersion } from '~/utils/packageVersion';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

const versionCache = {
  releaseVersion: null,
  lastFetched: null,
};

const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true,
};

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

interface AllMeta {
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
export class UtilsService {
  constructor(protected readonly configService: ConfigService<AppConfig>) {}

  async versionInfo() {
    if (
      !versionCache.lastFetched ||
      (versionCache.lastFetched &&
        versionCache.lastFetched < Date.now() - 1000 * 60 * 60)
    ) {
      const nonBetaTags = await axios
        .get('https://api.github.com/repos/nocodb/nocodb/tags', {
          timeout: 5000,
        })
        .then((response) => {
          return response.data
            .map((x) => x.name)
            .filter(
              (v) => validate(v) && !v.includes('finn') && !v.includes('beta'),
            )
            .sort((x, y) => compareVersions(y, x));
        })
        .catch(() => null);
      if (nonBetaTags && nonBetaTags.length > 0) {
        versionCache.releaseVersion = nonBetaTags[0];
      }
      versionCache.lastFetched = Date.now();
    }

    const response = {
      currentVersion: packageVersion,
      releaseVersion: versionCache.releaseVersion,
    };

    return response;
  }

  async appHealth() {
    return {
      message: 'OK',
      timestamp: Date.now(),
      uptime: process.uptime(),
    };
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

  async urlToDbConfig(param: {
    body: {
      url: string;
    };
  }) {
    const { url } = param.body;
    try {
      const connectionConfig = jdbcToXcConfig(url);
      return connectionConfig;
    } catch (error) {
      return NcError.internalServerError(
        'Please check server log for more details',
      );
    }
  }

  async aggregatedMetaInfo() {
    const [bases, userCount] = await Promise.all([
      Base.list({}),
      Noco.ncMeta.metaCount(null, null, MetaTable.USERS),
    ]);

    const result: AllMeta = {
      baseCount: bases.length,
      bases: [],
      userCount,
      sharedBaseCount: 0,
    };

    result.bases.push(
      ...this.extractResultOrNull(
        await Promise.allSettled(
          bases.map(async (base) => {
            if (base.uuid) result.sharedBaseCount++;
            const [
              tableCount,
              dbViewCount,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            ] = this.extractResultOrNull(
              await Promise.allSettled([
                // db tables  count
                Noco.ncMeta.metaCount(base.id, null, MetaTable.MODELS, {
                  condition: {
                    type: 'table',
                  },
                }),
                // db views count
                Noco.ncMeta.metaCount(base.id, null, MetaTable.MODELS, {
                  condition: {
                    type: 'view',
                  },
                }),
                // views count
                (async () => {
                  const views = await Noco.ncMeta.metaList2(
                    base.id,
                    null,
                    MetaTable.VIEWS,
                  );
                  // grid, form, gallery, kanban and shared count
                  return (views as any[]).reduce<ViewCount>(
                    (out, view) => {
                      out.total++;

                      switch (view.type) {
                        case ViewTypes.GRID:
                          out.gridCount++;
                          if (view.uuid) out.sharedGridCount++;
                          break;
                        case ViewTypes.FORM:
                          out.formCount++;
                          if (view.uuid) out.sharedFormCount++;
                          break;
                        case ViewTypes.GALLERY:
                          out.galleryCount++;
                          if (view.uuid) out.sharedGalleryCount++;
                          break;
                        case ViewTypes.KANBAN:
                          out.kanbanCount++;
                          if (view.uuid) out.sharedKanbanCount++;
                      }

                      if (view.uuid) {
                        if (view.password) out.sharedLockedCount++;
                        out.sharedTotal++;
                      }

                      return out;
                    },
                    {
                      formCount: 0,
                      gridCount: 0,
                      galleryCount: 0,
                      kanbanCount: 0,
                      total: 0,
                      sharedFormCount: 0,
                      sharedGridCount: 0,
                      sharedGalleryCount: 0,
                      sharedKanbanCount: 0,
                      sharedTotal: 0,
                      sharedLockedCount: 0,
                    },
                  );
                })(),
                // webhooks count
                Noco.ncMeta.metaCount(base.id, null, MetaTable.HOOKS),
                // filters count
                Noco.ncMeta.metaCount(base.id, null, MetaTable.FILTER_EXP),
                // sorts count
                Noco.ncMeta.metaCount(base.id, null, MetaTable.SORT),
                // row count per base
                base.getBases().then(async (sources) => {
                  return this.extractResultOrNull(
                    await Promise.allSettled(
                      sources.map(async (source) =>
                        (await NcConnectionMgrv2.getSqlClient(source))
                          .totalRecords?.()
                          ?.then((result) => result?.data),
                      ),
                    ),
                  );
                }),
                // base users count
                Noco.ncMeta.metaCount(null, null, MetaTable.PROJECT_USERS, {
                  condition: {
                    base_id: base.id,
                  },
                  aggField: '*',
                }),
              ]),
            );

            return {
              tableCount: { table: tableCount, view: dbViewCount },
              external: !base.is_meta,
              viewCount,
              webhookCount,
              filterCount,
              sortCount,
              rowCount,
              userCount,
            };
          }),
        ),
      ),
    );

    return result;
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

  async testConnection(param: { body: any }) {
    return await SqlMgrv2.testConnection(param.body);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const baseHasAdmin = !(await User.isFirst());
    const oidcAuthEnabled = !!(
      process.env.NC_OIDC_ISSUER &&
      process.env.NC_OIDC_AUTHORIZATION_URL &&
      process.env.NC_OIDC_TOKEN_URL &&
      process.env.NC_OIDC_USERINFO_URL &&
      process.env.NC_OIDC_CLIENT_ID &&
      process.env.NC_OIDC_CLIENT_SECRET
    );
    const oidcProviderName = oidcAuthEnabled
      ? process.env.NC_OIDC_PROVIDER_NAME ?? 'OpenID Connect'
      : null;

    const result = {
      authType: 'jwt',
      baseHasAdmin,
      firstUser: !baseHasAdmin,
      type: 'rest',
      env: process.env.NODE_ENV,
      googleAuthEnabled: !!(
        process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
      ),
      githubAuthEnabled: !!(
        process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
      ),
      oidcAuthEnabled,
      oidcProviderName,
      oneClick: !!process.env.NC_ONE_CLICK,
      connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
      version: packageVersion,
      defaultLimit: Math.max(
        Math.min(defaultLimitConfig.limitDefault, defaultLimitConfig.limitMax),
        defaultLimitConfig.limitMin,
      ),
      timezone: defaultConnectionConfig.timezone,
      ncMin: !!process.env.NC_MIN,
      teleEnabled: process.env.NC_DISABLE_TELE !== 'true',
      auditEnabled: process.env.NC_DISABLE_AUDIT !== 'true',
      ncSiteUrl: (param.req as any).ncSiteUrl,
      ee: Noco.isEE(),
      ncAttachmentFieldSize: NC_ATTACHMENT_FIELD_SIZE,
      ncMaxAttachmentsAllowed: +(process.env.NC_MAX_ATTACHMENTS_ALLOWED || 10),
      isCloud: process.env.NC_CLOUD === 'true',
      automationLogLevel: process.env.NC_AUTOMATION_LOG_LEVEL || 'OFF',
      baseHostName: process.env.NC_BASE_HOST_NAME,
      disableEmailAuth: this.configService.get('auth.disableEmailAuth', {
        infer: true,
      }),
      mainSubDomain: this.configService.get('mainSubDomain', { infer: true }),
      dashboardPath: this.configService.get('dashboardPath', { infer: true }),
    };

    return result;
  }
}
