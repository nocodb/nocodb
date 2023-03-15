import { Router } from 'express';
import Audit from '../models/Audit';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { auditService } from '../services';
import type { Request, Response } from 'express';

export async function commentRow(req: Request<any, any>, res) {
  res.json(
    await auditService.commentRow({
      rowId: req.params.rowId,
      user: (req as any).user,
      body: req.body,
    })
  );
}

export async function auditRowUpdate(req: Request<any, any>, res) {
  res.json(
    await auditService.auditRowUpdate({
      rowId: req.params.rowId,
      body: req.body,
    })
  );
}

export async function commentList(req: Request<any, any, any>, res) {
  res.json(
    new PagedResponseImpl(await auditService.commentList({ query: req.query }))
  );
}

export async function auditList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await auditService.auditList({
        query: req.query,
        projectId: req.params.projectId,
      }),
      {
        count: await Audit.projectAuditCount(req.params.projectId),
        ...req.query,
      }
    )
  );
}

export async function commentsCount(req: Request<any, any, any>, res) {
  res.json(
    await auditService.commentsCount({
      fk_model_id: req.query.fk_model_id as string,
      ids: req.query.ids as string[],
    })
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/meta/audits/comments',
  ncMetaAclMw(commentList, 'commentList')
);

router.post(
  '/api/v1/db/meta/audits/comments',
  ncMetaAclMw(commentRow, 'commentRow')
);

router.post(
  '/api/v1/db/meta/audits/rows/:rowId/update',
  ncMetaAclMw(auditRowUpdate, 'auditRowUpdate')
);

router.get(
  '/api/v1/db/meta/audits/comments/count',
  ncMetaAclMw(commentsCount, 'commentsCount')
);

router.get(
  '/api/v1/db/meta/projects/:projectId/audits',
  ncMetaAclMw(auditList, 'auditList')
);

export default router;
