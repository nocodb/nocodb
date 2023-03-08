// // Project CRUD
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import catchError from '../meta/helpers/catchError';
import { utilService } from '../services';
import type { Request, Response } from 'express';

export async function testConnection(req: Request, res: Response) {
  res.json(await utilService.testConnection({ body: req.body }));
}

export async function appInfo(req: Request, res: Response) {
  res.json(
    await utilService.appInfo({
      req: {
        ncSiteUrl: (req as any).ncSiteUrl,
      },
    })
  );
}

export async function versionInfo(_req: Request, res: Response) {
  res.json(await utilService.versionInfo());
}

export async function appHealth(_: Request, res: Response) {
  res.json(await utilService.appHealth());
}

export async function axiosRequestMake(req: Request, res: Response) {
  res.json(await utilService.axiosRequestMake({ body: req.body }));
}

export async function aggregatedMetaInfo(_req: Request, res: Response) {
  res.json(await utilService.aggregatedMetaInfo());
}

export async function urlToDbConfig(req: Request, res: Response) {
  res.json(
    await utilService.urlToDbConfig({
      body: req.body,
    })
  );
}

export default (router) => {
  router.post(
    '/api/v1/db/meta/connection/test',
    ncMetaAclMw(testConnection, 'testConnection')
  );
  router.get('/api/v1/db/meta/nocodb/info', catchError(appInfo));
  router.post('/api/v1/db/meta/axiosRequestMake', catchError(axiosRequestMake));
  router.get('/api/v1/version', catchError(versionInfo));
  router.get('/api/v1/health', catchError(appHealth));
  router.post('/api/v1/url_to_config', catchError(urlToDbConfig));
  router.get(
    '/api/v1/aggregated-meta-info',
    ncMetaAclMw(aggregatedMetaInfo, 'aggregatedMetaInfo')
  );
};
