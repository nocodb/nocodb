import { Injectable } from '@nestjs/common';
import { AuditsService as AuditsServiceCE } from 'src/services/audits.service';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class AuditsService extends AuditsServiceCE {
  constructor(
    protected readonly appHooksListenerService: AppHooksListenerService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(appHooksListenerService, appHooksService);
  }
}
