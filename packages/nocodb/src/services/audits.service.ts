import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import { AuditOperationSubTypes, AuditOperationTypes } from 'nocodb-sdk';
import type { AuditRowUpdateReqType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { validatePayload } from '~/helpers';
import { Audit, Model } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async auditRowUpdate(
    context: NcContext,
    param: { rowId: string; body: AuditRowUpdateReqType },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/AuditRowUpdateReq',
      param.body,
    );

    const model = await Model.getByIdOrName(context, {
      id: param.body.fk_model_id,
    });
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

  async auditOnlyList(param: {
    query: {
      row_id: string;
      fk_model_id: string;
    };
  }) {
    return await Audit.auditList(param.query);
  }

  async auditList(param: { query: any; baseId: string }) {
    return await Audit.baseAuditList(param.baseId, param.query);
  }

  async auditCount(param: { query?: any; baseId: string }) {
    return await Audit.baseAuditCount(param.baseId, param.query);
  }

  async sourceAuditList(param: { query: any; sourceId: any }) {
    return await Audit.sourceAuditList(param.sourceId, param.query);
  }

  async sourceAuditCount(param: { query: any; sourceId: string }) {
    return await Audit.sourceAuditCount(param.sourceId);
  }

  async projectAuditList(param: { query: any }) {
    return await Audit.projectAuditList(param.query);
  }

  async projectAuditCount() {
    return await Audit.projectAuditCount();
  }
}
