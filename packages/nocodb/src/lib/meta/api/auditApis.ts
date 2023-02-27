import { Request, Response, Router } from 'express';
import Audit from '../../models/Audit';
import { AuditOperationSubTypes, AuditOperationTypes } from 'nocodb-sdk';
import Model from '../../models/Model';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import ncMetaAclMw from '../helpers/ncMetaAclMw';

import DOMPurify from 'isomorphic-dompurify';
import { getAjvValidatorMw } from './helpers';

export async function commentRow(req: Request<any, any>, res) {
  res.json(
    await Audit.insert({
      ...req.body,
      user: (req as any).user?.email,
      op_type: AuditOperationTypes.COMMENT,
    })
  );
}

export async function auditRowUpdate(req: Request<any, any>, res) {
  const model = await Model.getByIdOrName({ id: req.body.fk_model_id });
  res.json(
    await Audit.insert({
      fk_model_id: req.body.fk_model_id,
      row_id: req.params.rowId,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: DOMPurify.sanitize(
        `Table ${model.table_name} : field ${req.body.column_name} got changed from  ${req.body.prev_value} to ${req.body.value}`
      ),
      details: DOMPurify.sanitize(`<span class="">${req.body.column_name}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${req.body.prev_value}</span>
  <span class="black--text green lighten-4 px-2">${req.body.value}</span>`),
      ip: (req as any).clientIp,
      user: (req as any).user?.email,
    })
  );
}

export async function commentList(req: Request<any, any, any>, res) {
  res.json(await Audit.commentsList(req.query));
}

export async function auditList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await Audit.projectAuditList(req.params.projectId, req.query),
      {
        count: await Audit.projectAuditCount(req.params.projectId),
        ...req.query,
      }
    )
  );
}

export async function commentsCount(req: Request<any, any, any>, res) {
  res.json(
    await Audit.commentsCount({
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
  getAjvValidatorMw('swagger.json#/components/schemas/CommentReq'),
  ncMetaAclMw(commentRow, 'commentRow')
);
router.post(
  '/api/v1/db/meta/audits/rows/:rowId/update',
  getAjvValidatorMw('swagger.json#/components/schemas/AuditRowUpdateReq'),
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
