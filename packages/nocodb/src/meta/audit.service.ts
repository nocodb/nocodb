import { Injectable, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MetaService } from '~/meta/meta.service';
import { NcConfig } from '~/utils/nc-config';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AuditService extends MetaService {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }
}
