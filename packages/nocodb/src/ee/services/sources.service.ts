import { Injectable } from '@nestjs/common';
import { SourcesService as BasesServiceCE } from 'src/services/sources.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';

@Injectable()
export class SourcesService extends BasesServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
  ) {
    super(appHooksService);
  }
}
