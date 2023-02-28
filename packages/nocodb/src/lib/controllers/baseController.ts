import { Request, Response } from 'express';
import { BaseListType } from 'nocodb-sdk';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import Base from '../models/Base';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';

import { baseService } from '../services';

export async function baseGet(req: Request<any>, res: Response<Base>) {
  const base = await baseService.baseGetWithConfig({
    baseId: req.params.baseId,
  });

  res.json(base);
}

export async function baseUpdate(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const base = await baseService.baseUpdate({
    baseId: req.params.baseId,
    base: req.body,
    projectId: req.params.projectId,
  });
  res.json(base);
}

export async function baseList(
  req: Request<any, any, any>,
  res: Response<BaseListType>
) {
  const bases = await baseService.baseList({
    projectId: req.params.projectId,
  });

  res // todo: pagination
    .json({
      bases: new PagedResponseImpl(bases, {
        count: bases.length,
        limit: bases.length,
      }),
    });
}

export async function baseDelete(
  req: Request<any, any, any>,
  res: Response<any>
) {
  const result = await baseService.baseDelete({
    baseId: req.params.baseId,
  });
  res.json(result);
}

async function baseCreate(req: Request<any, any>, res) {
  const base = await baseService.baseCreate({
    projectId: req.params.projectId,
    base: req.body,
  });

  res.json(base);
}

export default (router) => {
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseGet, 'baseGet')
  );
  router.patch(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    getAjvValidatorMw('swagger.json#/components/schemas/BaseReq'),
    ncMetaAclMw(baseUpdate, 'baseUpdate')
  );
  router.delete(
    '/api/v1/db/meta/projects/:projectId/bases/:baseId',
    metaApiMetrics,
    ncMetaAclMw(baseDelete, 'baseDelete')
  );
  router.post(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    getAjvValidatorMw('swagger.json#/components/schemas/BaseReq'),
    ncMetaAclMw(baseCreate, 'baseCreate')
  );
  router.get(
    '/api/v1/db/meta/projects/:projectId/bases',
    metaApiMetrics,
    ncMetaAclMw(baseList, 'baseList')
  );
};
