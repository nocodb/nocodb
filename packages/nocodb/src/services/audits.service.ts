import { Injectable } from '@nestjs/common';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { Audit } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async auditOnlyList(param: {
    query: {
      row_id: string;
      fk_model_id: string;
      cursor?: string;
    },
  ) {
    return await Audit.recordAuditList(context, param);
  }
}
