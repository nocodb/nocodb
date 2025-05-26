import { Injectable, Optional } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { MetaService } from '~/meta/meta.service';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AuditService extends MetaService {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  /***
   * Generate nanoid for the given target
   * @param target - Table name
   * @returns {string} - Generated nanoid
   * */
  public async genNanoid(target: string) {
    if (target === MetaTable.AUDIT || target === MetaTable.RECORD_AUDIT) {
      return uuidv7();
    }

    // using nanoid to avoid collision with existing ids when duplicating
    return super.genNanoid(target);
  }
}
