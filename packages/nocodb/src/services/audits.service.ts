import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { Audit } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AuditsService {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async recordAuditList(
    context: NcContext,
    param: {
      row_id: string;
      fk_model_id: string;
      cursor?: string;
      retentionLimit?: number;
    },
  ) {
    return await Audit.recordAuditList(context, param);
  }
}
