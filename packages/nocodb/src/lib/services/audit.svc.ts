import { validatePayload } from '../meta/api/helpers';
import Audit from '../models/Audit';
import type { AuditRowUpdateReqType } from 'nocodb-sdk';
import { AuditOperationSubTypes, AuditOperationTypes } from 'nocodb-sdk';
import Model from '../models/Model';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';

import DOMPurify from 'isomorphic-dompurify';

export async function commentRow(param: {
  rowId: string;
  body: AuditRowUpdateReqType;
  user: any;
}) {
  await validatePayload(
    'swagger.json#/components/schemas/CommentReq',
    param.body
  );

  return await Audit.insert({
    ...param.body,
    user: param.user?.email,
    op_type: AuditOperationTypes.COMMENT,
  });
}

export async function auditRowUpdate(param: {
  rowId: string;
  body: AuditRowUpdateReqType;
}) {
  await validatePayload(
    'swagger.json#/components/schemas/AuditRowUpdateReq',
    param.body
  );

  const model = await Model.getByIdOrName({ id: param.body.fk_model_id });
  return await Audit.insert({
    fk_model_id: param.body.fk_model_id,
    row_id: param.rowId,
    op_type: AuditOperationTypes.DATA,
    op_sub_type: AuditOperationSubTypes.UPDATE,
    description: DOMPurify.sanitize(
      `Table ${model.table_name} : field ${param.body.column_name} got changed from  ${param.body.prev_value} to ${param.body.value}`
    ),
    details: DOMPurify.sanitize(`<span class="">${param.body.column_name}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${param.body.prev_value}</span>
  <span class="black--text green lighten-4 px-2">${param.body.value}</span>`),
    ip: (param as any).clientIp,
    user: (param as any).user?.email,
  });
}

export async function commentList(param: { query: any }) {
  return await Audit.commentsList(param.query);
}

export async function auditList(param: { query: any; projectId: string }) {
  return new PagedResponseImpl(
    await Audit.projectAuditList(param.projectId, param.query),
    {
      count: await Audit.projectAuditCount(param.projectId),
      ...param.query,
    }
  );
}

export async function commentsCount(param: {
  fk_model_id: string;
  ids: string[];
}) {
  return await Audit.commentsCount({
    fk_model_id: param.fk_model_id as string,
    ids: param.ids as string[],
  });
}
