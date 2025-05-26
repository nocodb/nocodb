import { Injectable } from '@nestjs/common';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { Audit, RecordAudit } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async recordAuditList(param: {
    query: {
      row_id: string;
      fk_model_id: string;
      limit?: string | number;
      offset?: string | number;
    };
  }) {
    return await RecordAudit.auditList(param.query);
  }

  async recordAuditCount(param: {
    query?: {
      row_id: string;
      fk_model_id: string;
    };
  }) {
    return await RecordAudit.auditCount({
      fk_model_id: param.query.fk_model_id,
      row_id: param.query.row_id,
    });
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
