import process from 'process';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { compareVersions, validate } from 'compare-versions';
import { ViewTypes } from 'nocodb-sdk';
import { ConfigService } from '@nestjs/config';
import { useAgent } from 'request-filtering-agent';
import dayjs from 'dayjs';
import type { ErrorReportReqType } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import {
  NC_APP_SETTINGS,
  NC_ATTACHMENT_FIELD_SIZE,
  NC_MAX_ATTACHMENTS_ALLOWED,
} from '~/constants';
import SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import { NcError } from '~/helpers/catchError';
import { Base, Store, User } from '~/models';
import Noco from '~/Noco';
import { isOnPrem, T } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import getInstance from '~/utils/getInstance';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import { jdbcToXcConfig } from '~/utils/nc-config/helpers';
import { packageVersion } from '~/utils/packageVersion';
import {
  defaultGroupByLimitConfig,
  defaultLimitConfig,
} from '~/helpers/extractLimitAndOffset';
import { DriverClient } from '~/utils/nc-config';
import NocoCache from '~/cache/NocoCache';
import { getCircularReplacer } from '~/utils';

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
  protected logger = new Logger(UtilsService.name);

  constructor(protected readonly configService: ConfigService<AppConfig>) {}

  lastSyncTime = null;

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
    // TODO: fix or deprecate for EE
    const [bases, userCount] = await Promise.all([
      Base.list(),
      Noco.ncMeta.metaCount(RootScopes.ROOT, RootScopes.ROOT, MetaTable.USERS),
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
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.MODELS,
                  {
                    condition: {
                      type: 'table',
                    },
                  },
                ),
                // db views count
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.MODELS,
                  {
                    condition: {
                      type: 'view',
                    },
                  },
                ),
                // views count
                (async () => {
                  const views = await Noco.ncMeta.metaList2(
                    base.fk_workspace_id,
                    base.id,
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
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.HOOKS,
                ),
                // filters count
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.FILTER_EXP,
                ),
                // sorts count
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.SORT,
                ),
                // row count per base
                base.getSources().then(async (sources) => {
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
                Noco.ncMeta.metaCount(
                  base.fk_workspace_id,
                  base.id,
                  MetaTable.PROJECT_USERS,
                  {
                    condition: {
                      base_id: base.id,
                    },
                    aggField: '*',
                  },
                ),
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
      return null;
    });
  };

  async testConnection(param: { body: any }) {
    return await SqlMgrv2.testConnection(param.body);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const baseHasAdmin = !(await User.isFirst());
    const instance = await getInstance();

    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS, true))?.value);
    } catch {}

    const oidcAuthEnabled = ['openid', 'oidc'].includes(
      process.env.NC_SSO?.toLowerCase(),
    );
    const oidcProviderName = oidcAuthEnabled
      ? process.env.NC_OIDC_PROVIDER_NAME ?? 'OpenID Connect'
      : null;

    let giftUrl: string;

    if (instance.impacted >= 5) {
      giftUrl = `https://w21dqb1x.nocodb.com/#/nc/form/4d2e0e4b-df97-4c5e-ad8e-f8b8cca90330?Users=${
        instance.impacted
      }&Bases=${instance.projectsExt + instance.projectsMeta}`;
    }

    const samlAuthEnabled = process.env.NC_SSO?.toLowerCase() === 'saml';
    const samlProviderName = samlAuthEnabled
      ? process.env.NC_SSO_SAML_PROVIDER_NAME ?? 'SAML'
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
      defaultGroupByLimit: defaultGroupByLimitConfig,
      timezone: defaultConnectionConfig.timezone,
      ncMin: !!process.env.NC_MIN,
      teleEnabled: process.env.NC_DISABLE_TELE !== 'true',
      errorReportingEnabled: process.env.NC_DISABLE_ERR_REPORTS !== 'true',
      sentryDSN:
        process.env.NC_DISABLE_ERR_REPORTS !== 'true'
          ? process.env.NC_SENTRY_DSN
          : null,
      auditEnabled: process.env.NC_DISABLE_AUDIT !== 'true',
      ncSiteUrl: (param.req as any).ncSiteUrl,
      ee: Noco.isEE(),
      ncAttachmentFieldSize: NC_ATTACHMENT_FIELD_SIZE,
      ncMaxAttachmentsAllowed: NC_MAX_ATTACHMENTS_ALLOWED,
      isCloud: process.env.NC_CLOUD === 'true',
      automationLogLevel: process.env.NC_AUTOMATION_LOG_LEVEL || 'OFF',
      baseHostName: process.env.NC_BASE_HOST_NAME,
      disableEmailAuth: this.configService.get('auth.disableEmailAuth', {
        infer: true,
      }),
      feedEnabled: process.env.NC_DISABLE_PRODUCT_FEED !== 'true',
      mainSubDomain: this.configService.get('mainSubDomain', { infer: true }),
      dashboardPath: this.configService.get('dashboardPath', { infer: true }),
      inviteOnlySignup: settings.invite_only_signup,
      samlProviderName,
      samlAuthEnabled,
      giftUrl,
      prodReady: Noco.getConfig()?.meta?.db?.client !== DriverClient.SQLITE,
      isOnPrem,
    };

    return result;
  }

  async reportErrors(param: { body: ErrorReportReqType; req: NcRequest }) {
    for (const error of param.body?.errors ?? []) {
      T.emit('evt', {
        evt_type: 'gui:error',
        properties: {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 2).join('\n'),
          ...(param.body.extra || {}),
        },
      });
    }
  }

  async feed(req: NcRequest) {
    const {
      type = 'all',
      page = '1',
      per_page = '10',
    } = req.query as {
      type: 'github' | 'youtube' | 'all' | 'twitter' | 'cloud';
      page: string;
      per_page: string;
    };

    const perPage = Math.min(Math.max(parseInt(per_page, 10) || 10, 1), 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    const cacheKey = `${CacheScope.PRODUCT_FEED}:${type}:${pageNum}:${perPage}`;

    const cachedData = await NocoCache.get(cacheKey, 'json');

    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        this.logger.error(e?.message, e);
        await NocoCache.del(cacheKey);
      }
    }

    let payload = null;
    if (
      !this.lastSyncTime ||
      dayjs().isAfter(this.lastSyncTime.add(3, 'hours'))
    ) {
      payload = await T.payload();
      this.lastSyncTime = dayjs();
    }

    let response;

    try {
      response = await axios.post(
        'https://product-feed.nocodb.com/api/v1/social/feed',
        payload,
        {
          params: {
            per_page: perPage,
            page: pageNum,
            type,
          },
        },
      );
    } catch (e) {
      this.logger.error(e?.message, e);
      return [];
    }

    // The feed includes the attachments, which has the presigned URL
    // So the cache should match the presigned URL cache
    await NocoCache.setExpiring(
      cacheKey,
      JSON.stringify(response.data, getCircularReplacer),
      Number.isNaN(parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS))
        ? 2 * 60 * 60
        : parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS),
    );

    return response.data;
  }
}
