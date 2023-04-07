import { Controller, Get, Param } from '@nestjs/common';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import { SortsService } from './sorts.service';

@Controller('sorts')
export class SortsController {
  constructor(private readonly sortsService: SortsService) {}

  @Get('/api/v1/db/meta/views/:viewId/sorts/')
  async sortList(@Param('viewId') viewId: string) {
    return;
    new PagedResponseImpl(
      await this.sortsService.sortList({
        viewId,
      }),
    );
  }
}

/*


export async function sortCreate(req: Request<any, any, SortReqType>, res) {
  const sort = await sortService.sortCreate({
    sort: req.body,
    viewId: req.params.viewId,
  });
  res.json(sort);
}

export async function sortUpdate(req, res) {
  const sort = await sortService.sortUpdate({
    sortId: req.params.sortId,
    sort: req.body,
  });
  res.json(sort);
}

export async function sortDelete(req: Request, res: Response) {
  const sort = await sortService.sortDelete({
    sortId: req.params.sortId,
  });
  res.json(sort);
}

export async function sortGet(req: Request, res: Response) {
  const sort = await sortService.sortGet({
    sortId: req.params.sortId,
  });
  res.json(sort);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/views/:viewId/sorts/',
  metaApiMetrics,
  ncMetaAclMw(sortCreate, 'sortCreate')
);

router.get(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortGet, 'sortGet')
);

router.patch(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortUpdate, 'sortUpdate')
);
router.delete(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortDelete, 'sortDelete')
);
export default router;

* */
