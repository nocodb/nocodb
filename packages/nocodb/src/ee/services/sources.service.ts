import { Injectable } from '@nestjs/common';
import { SourcesService as SourcesServiceCE } from 'src/services/sources.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';

@Injectable()
export class SourcesService extends SourcesServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected metaService: MetaService,
  ) {
    super(appHooksService);
  }
}
