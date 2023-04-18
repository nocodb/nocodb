import { Router } from 'express';
import catchError from '../meta/helpers/catchError';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { hookService } from '../services';
import type { HookListType, HookLogListType, HookType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

export async function hookList(
  req: Request<any, any, any>,
  res: Response<HookListType>
) {
  res.json(
    new PagedResponseImpl(
      await hookService.hookList({ tableId: req.params.tableId })
    )
  );
}

export async function hookCreate(
  req: Request<any, HookType>,
  res: Response<HookType>
) {
  const hook = await hookService.hookCreate({
    hook: req.body,
    tableId: req.params.tableId,
  });
  res.json(hook);
}

export async function hookDelete(
  req: Request<any, HookType>,
  res: Response<any>
) {
  res.json(await hookService.hookDelete({ hookId: req.params.hookId }));
}

export async function hookUpdate(
  req: Request<any, HookType>,
  res: Response<HookType>
) {
  res.json(
    await hookService.hookUpdate({ hookId: req.params.hookId, hook: req.body })
  );
}

export async function hookTest(req: Request<any, any>, res: Response) {
  try {
    await hookService.hookTest({
      hookTest: {
        ...req.body,
        payload: {
          ...req.body.payload,
          user: (req as any)?.user,
        },
      },
      tableId: req.params.tableId,
    });
    res.json({ msg: 'The hook has been tested successfully' });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function tableSampleData(req: Request, res: Response) {
  res.json(
    await hookService.tableSampleData({
      tableId: req.params.tableId,
      operation: req.params.operation as HookType['operation'],
      version: req.params.version as HookType['version'],
    })
  );
}

export async function hookLogList(
  req: Request<any, any, any>,
  res: Response<HookLogListType>
) {
  res.json(
    new PagedResponseImpl(
      await hookService.hookLogList({
        query: req.query,
        hookId: req.params.hookId,
      }),
      {
        ...req.query,
        count: await hookService.hookLogCount({
          hookId: req.params.hookId,
        }),
      }
    )
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/tables/:tableId/hooks',
  metaApiMetrics,
  ncMetaAclMw(hookList, 'hookList')
);

router.post(
  '/api/v1/db/meta/tables/:tableId/hooks/test',
  metaApiMetrics,
  ncMetaAclMw(hookTest, 'hookTest')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks',
  metaApiMetrics,
  ncMetaAclMw(hookCreate, 'hookCreate')
);
router.delete(
  '/api/v1/db/meta/hooks/:hookId',
  metaApiMetrics,
  ncMetaAclMw(hookDelete, 'hookDelete')
);
router.patch(
  '/api/v1/db/meta/hooks/:hookId',
  metaApiMetrics,
  ncMetaAclMw(hookUpdate, 'hookUpdate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation/:version',
  metaApiMetrics,
  catchError(tableSampleData)
);

router.get(
  '/api/v1/db/meta/hooks/:hookId/logs',
  metaApiMetrics,
  ncMetaAclMw(hookLogList, 'hookLogList')
);

export default router;
