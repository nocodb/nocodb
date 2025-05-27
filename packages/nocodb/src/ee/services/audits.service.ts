import { Injectable } from '@nestjs/common';
import { AuditsService as AuditsServiceCE } from 'src/services/audits.service';
import type { NcContext } from '~/interface/config';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Audit } from '~/models';

@Injectable()
export class AuditsService extends AuditsServiceCE {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(appHooksListenerService, appHooksService);
  }

  async workspaceAuditList(
    context: NcContext,
    param: {
      page?: number;
      baseId?: string;
      user?: string;
      type?: string[];
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
      };
    },
  ) {
    return new PagedResponseImpl(
      await Audit.workspaceAuditList(context, param),
      {
        count: await Audit.workspaceAuditCount(context, param),
      },
    );
  }
}
