import { Injectable, Optional } from '@nestjs/common';
import { MetaService } from '~/meta/meta.service';
import { NcConfig } from '~/utils/nc-config';

@Injectable()
export class DocsContentService extends MetaService {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }
}
