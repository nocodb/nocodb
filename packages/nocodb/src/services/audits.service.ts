import { Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { Audit } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';

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
    },
  ) {
    return new PagedResponseImpl(await Audit.recordAuditList(context, param));
  }
}
