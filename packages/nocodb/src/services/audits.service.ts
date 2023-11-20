import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { AuditOperationSubTypes, AuditOperationTypes } from 'nocodb-sdk';
import type { AuditRowUpdateReqType, CommentUpdateReqType } from 'nocodb-sdk';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { Audit, Model } from '~/models';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
  ) {}

  async commentRow(param: { body: AuditRowUpdateReqType; user: any }) {
    validatePayload('swagger.json#/components/schemas/CommentReq', param.body);

    return await Audit.insert({
      ...param.body,
      user: param.user?.email,
      op_type: AuditOperationTypes.COMMENT,
    });
  }

  async auditRowUpdate(param: { rowId: string; body: AuditRowUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/AuditRowUpdateReq',
      param.body,
    );

    const model = await Model.getByIdOrName({ id: param.body.fk_model_id });
    return await Audit.insert({
      fk_model_id: param.body.fk_model_id,
      row_id: param.rowId,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: DOMPurify.sanitize(
        `Table ${model.table_name} : field ${param.body.column_name} got changed from  ${param.body.prev_value} to ${param.body.value}`,
      ),
      details:
        DOMPurify.sanitize(`<span class="">${param.body.column_name}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${param.body.prev_value}</span>
  <span class="black--text green lighten-4 px-2">${param.body.value}</span>`),
      ip: (param as any).clientIp,
      user: (param as any).user?.email,
    });

    //  return this.appHooksListenerService.auditInsert({
    //     fk_model_id: param.body.fk_model_id,
    //     row_id: param.rowId,
    //     op_type: AuditOperationTypes.DATA,
    //     op_sub_type: AuditOperationSubTypes.UPDATE,
    //     description: DOMPurify.sanitize(
    //       `Table ${model.table_name} : field ${param.body.column_name} got changed from  ${param.body.prev_value} to ${param.body.value}`,
    //     ),
    //     details:
    //       DOMPurify.sanitize(`<span class="">${param.body.column_name}</span>
    // : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${param.body.prev_value}</span>
    // <span class="black--text green lighten-4 px-2">${param.body.value}</span>`),
    //     ip: (param as any).clientIp,
    //     user: (param as any).user?.email,
    //   })
  }

  async commentList(param: { query: any }) {
    return await Audit.commentsList(param.query);
  }

  async auditList(param: { query: any; baseId: string }) {
    return await Audit.baseAuditList(param.baseId, param.query);
  }

  async auditCount(param: { query?: any; baseId: string }) {
    return await Audit.baseAuditCount(param.baseId, param.query?.sourceId);
  }

  async commentsCount(param: { fk_model_id: string; ids: string[] }) {
    return await Audit.commentsCount({
      fk_model_id: param.fk_model_id as string,
      ids: param.ids as string[],
    });
  }

  async commentUpdate(param: {
    auditId: string;
    userEmail: string;
    body: CommentUpdateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/CommentUpdateReq',
      param.body,
    );

    const log = await Audit.get(param.auditId);
    if (log.op_type !== AuditOperationTypes.COMMENT) {
      NcError.forbidden('Only comments can be updated');
    }

    if (log.user !== param.userEmail) {
      NcError.unauthorized('Unauthorized access');
    }
    return await Audit.commentUpdate(param.auditId, param.body);
  }

  async baseAuditList(param: { query: any; sourceId: any }) {
    return await Audit.baseAuditList(param.sourceId, param.query);
  }

  async baseAuditCount(param: { sourceId: string }) {
    return await Audit.baseAuditCount(param.sourceId);
  }
}
