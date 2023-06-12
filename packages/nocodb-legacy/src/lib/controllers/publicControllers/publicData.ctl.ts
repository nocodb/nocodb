import { Router } from 'express';
import multer from 'multer';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';
import catchError from '../../meta/helpers/catchError';
import { publicDataService } from '../../services';
import type { Request, Response } from 'express';

export async function dataList(req: Request, res: Response) {
  const pagedResponse = await publicDataService.dataList({
    query: req.query,
    password: req.headers?.['xc-password'] as string,
    sharedViewUuid: req.params.sharedViewUuid,
  });
  res.json(pagedResponse);
}

// todo: Handle the error case where view doesnt belong to model
async function groupedDataList(req: Request, res: Response) {
  const groupedData = await publicDataService.groupedDataList({
    query: req.query,
    password: req.headers?.['xc-password'] as string,
    sharedViewUuid: req.params.sharedViewUuid,
    groupColumnId: req.params.columnId,
  });
  res.json(groupedData);
}

async function dataInsert(req: Request & { files: any[] }, res: Response) {
  const insertResult = await publicDataService.dataInsert({
    sharedViewUuid: req.params.sharedViewUuid,
    password: req.headers?.['xc-password'] as string,
    body: req.body?.data,
    siteUrl: (req as any).ncSiteUrl,
    // req.files is enriched by multer
    files: req.files,
  });

  res.json(insertResult);
}

async function relDataList(req, res) {
  const pagedResponse = await publicDataService.relDataList({
    query: req.query,
    password: req.headers?.['xc-password'] as string,
    sharedViewUuid: req.params.sharedViewUuid,
    columnId: req.params.columnId,
  });

  res.json(pagedResponse);
}

export async function publicMmList(req: Request, res: Response) {
  const paginatedResponse = await publicDataService.publicMmList({
    query: req.query,
    password: req.headers?.['xc-password'] as string,
    sharedViewUuid: req.params.sharedViewUuid,
    columnId: req.params.columnId,
    rowId: req.params.rowId,
  });
  res.json(paginatedResponse);
}

export async function publicHmList(req: Request, res: Response) {
  const paginatedResponse = await publicDataService.publicHmList({
    query: req.query,
    password: req.headers?.['xc-password'] as string,
    sharedViewUuid: req.params.sharedViewUuid,
    columnId: req.params.columnId,
    rowId: req.params.rowId,
  });
  res.json(paginatedResponse);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
  catchError(dataList)
);
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/group/:columnId',
  catchError(groupedDataList)
);
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId',
  catchError(relDataList)
);
router.post(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
  multer({
    storage: multer.diskStorage({}),
    limits: {
      fieldSize: NC_ATTACHMENT_FIELD_SIZE,
    },
  }).any(),
  catchError(dataInsert)
);

router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:columnId',
  catchError(publicMmList)
);
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:columnId',
  catchError(publicHmList)
);

export default router;
