import { Injectable } from '@nestjs/common';
import { BasesService as BasesServiceCE } from 'src/services/bases.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';

@Injectable()
export class BasesService extends BasesServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
  ) {
    super(appHooksService);
  }
}
