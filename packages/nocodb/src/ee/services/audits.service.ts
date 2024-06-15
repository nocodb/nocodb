import { Injectable } from '@nestjs/common';
import { AuditsService as AuditsServiceCE } from 'src/services/audits.service';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Audit } from '~/models';

@Injectable()
export class AuditsService extends AuditsServiceCE {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(appHooksListenerService, appHooksService);
  }

  async workspaceAuditList(param: { query: any; workspaceId: any }) {
    return await Audit.workspaceAuditList(param.workspaceId, param.query);
  }

  async workspaceAuditCount(param: { workspaceId: string }) {
    return await Audit.workspaceAuditCount(param.workspaceId);
  }
}
