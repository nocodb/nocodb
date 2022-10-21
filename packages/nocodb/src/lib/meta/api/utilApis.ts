// // Project CRUD
import { Request, Response } from 'express';

import { ViewTypes } from 'nocodb-sdk';
import Project from '../../models/Project';
import Noco from '../../Noco';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { MetaTable } from '../../utils/globals';
import { packageVersion } from '../../utils/packageVersion';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import SqlMgrv2 from '../../db/sql-mgr/v2/SqlMgrv2';
import NcConfigFactory, {
  defaultConnectionConfig,
} from '../../utils/NcConfigFactory';
import User from '../../models/User';
import catchError from '../helpers/catchError';
import axios from 'axios';
import { feedbackForm } from 'nc-help';

const versionCache = {
  releaseVersion: null,
  lastFetched: null,
};

export async function testConnection(req: Request, res: Response) {
  res.json(await SqlMgrv2.testConnection(req.body));
}

export async function appInfo(req: Request, res: Response) {
  const projectHasAdmin = !(await User.isFirst());
  const result = {
    authType: 'jwt',
    projectHasAdmin,
    firstUser: !projectHasAdmin,
    type: 'rest',
    env: process.env.NODE_ENV,
    googleAuthEnabled: !!(
      process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
    ),
    githubAuthEnabled: !!(
      process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
    ),
    oneClick: !!process.env.NC_ONE_CLICK,
    connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
    version: packageVersion,
    defaultLimit: Math.max(
      Math.min(
        +process.env.DB_QUERY_LIMIT_DEFAULT || 25,
        +process.env.DB_QUERY_LIMIT_MAX || 100
      ),
      +process.env.DB_QUERY_LIMIT_MIN || 1
    ),
    timezone: defaultConnectionConfig.timezone,
    ncMin: !!process.env.NC_MIN,
    teleEnabled: !process.env.NC_DISABLE_TELE,
    ncSiteUrl: (req as any).ncSiteUrl,
  };

  res.json(result);
}

export async function versionInfo(_req: Request, res: Response) {
  if (
    !versionCache.lastFetched ||
    (versionCache.lastFetched &&
      versionCache.lastFetched < Date.now() - 1000 * 60 * 60)
  ) {
    versionCache.releaseVersion = await axios
      .get('https://github.com/nocodb/nocodb/releases/latest', {
        timeout: 5000,
      })
      .then((response) =>
        response.request.res.responseUrl.replace(
          'https://github.com/nocodb/nocodb/releases/tag/',
          ''
        )
      )
      .catch(() => null);
    versionCache.lastFetched = Date.now();
  }

  const response = {
    currentVersion: packageVersion,
    releaseVersion: versionCache.releaseVersion,
  };

  res.json(response);
}

export function feedbackFormGet(_req: Request, res: Response) {
  feedbackForm()
    .then((form) => res.json(form))
    .catch((e) => res.json({ error: e.message }));
}

export async function appHealth(_: Request, res: Response) {
  res.json({
    message: 'OK',
    timestamp: Date.now(),
    uptime: process.uptime(),
  });
}

async function _axiosRequestMake(req: Request, res: Response) {
  const { apiMeta } = req.body;

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
  };
  const data = await require('axios')(_req);
  return res.json(data?.data);
}

export async function axiosRequestMake(req: Request, res: Response) {
  const {
    apiMeta: { url },
  } = req.body;
  const isExcelImport = /.*\.(xls|xlsx|xlsm|ods|ots)/;
  const isCSVImport = /.*\.(csv)/;
  const ipBlockList =
    /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g;
  if (
    ipBlockList.test(url) ||
    (!isCSVImport.test(url) && !isExcelImport.test(url))
  ) {
    return res.json({});
  }
  if (isCSVImport || isExcelImport) {
    req.body.apiMeta.responseType = 'arraybuffer';
  }
  return await _axiosRequestMake(req, res);
}

export async function urlToDbConfig(req: Request, res: Response) {
  const { url } = req.body;
  try {
    const connectionConfig = NcConfigFactory.extractXcUrlFromJdbc(url, true);
    return res.json(connectionConfig);
  } catch (error) {
    return res.sendStatus(500);
  }
}

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
  projectCount: number;
  projects: (
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

export async function aggregatedMetaInfo(_req: Request, res: Response) {
  const [projects, userCount] = await Promise.all([
    Project.list({}),
    Noco.ncMeta.metaCount(null, null, MetaTable.USERS),
  ]);

  const result: AllMeta = {
    projectCount: projects.length,
    projects: [],
    userCount,
    sharedBaseCount: 0,
  };

  result.projects.push(
    ...extractResultOrNull(
      await Promise.allSettled(
        projects.map(async (project) => {
          if (project.uuid) result.sharedBaseCount++;
          const [
            tableCount,
            dbViewCount,
            viewCount,
            webhookCount,
            filterCount,
            sortCount,
            rowCount,
            userCount,
          ] = extractResultOrNull(
            await Promise.allSettled([
              // db tables  count
              Noco.ncMeta.metaCount(project.id, null, MetaTable.MODELS, {
                condition: {
                  type: 'table',
                },
              }),
              // db views count
              Noco.ncMeta.metaCount(project.id, null, MetaTable.MODELS, {
                condition: {
                  type: 'view',
                },
              }),
              // views count
              (async () => {
                const views = await Noco.ncMeta.metaList2(
                  project.id,
                  null,
                  MetaTable.VIEWS
                );
                // grid, form, gallery, kanban and shared count
                return views.reduce<ViewCount>(
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
                  }
                );
              })(),
              // webhooks count
              Noco.ncMeta.metaCount(project.id, null, MetaTable.HOOKS),
              // filters count
              Noco.ncMeta.metaCount(project.id, null, MetaTable.FILTER_EXP),
              // sorts count
              Noco.ncMeta.metaCount(project.id, null, MetaTable.SORT),
              // row count per base
              project.getBases().then(async (bases) => {
                return extractResultOrNull(
                  await Promise.allSettled(
                    bases.map((base) =>
                      NcConnectionMgrv2.getSqlClient(base)
                        .totalRecords?.()
                        ?.then((result) => result?.data)
                    )
                  )
                );
              }),
              // project users count
              Noco.ncMeta.metaCount(null, null, MetaTable.PROJECT_USERS, {
                condition: {
                  project_id: project.id,
                },
                aggField: '*',
              }),
            ])
          );

          return {
            tableCount: { table: tableCount, view: dbViewCount },
            external: !project.is_meta,
            viewCount,
            webhookCount,
            filterCount,
            sortCount,
            rowCount,
            userCount,
          };
        })
      )
    )
  );

  res.json(result);
}

const extractResultOrNull = (results: PromiseSettledResult<any>[]) => {
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    console.log(result.reason);
    return null;
  });
};

export default (router) => {
  router.post(
    '/api/v1/db/meta/connection/test',
    ncMetaAclMw(testConnection, 'testConnection')
  );
  router.get('/api/v1/db/meta/nocodb/info', catchError(appInfo));
  router.post('/api/v1/db/meta/axiosRequestMake', catchError(axiosRequestMake));
  router.get('/api/v1/version', catchError(versionInfo));
  router.get('/api/v1/health', catchError(appHealth));
  router.get('/api/v1/feedback_form', catchError(feedbackFormGet));
  router.post('/api/v1/url_to_config', catchError(urlToDbConfig));
  router.get(
    '/api/v1/aggregated-meta-info',
    ncMetaAclMw(aggregatedMetaInfo, 'aggregatedMetaInfo')
  );
};
