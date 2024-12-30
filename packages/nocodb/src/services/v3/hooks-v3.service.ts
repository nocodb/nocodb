import { Inject, Injectable } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Hook } from '~/models';
import { DatasService } from '~/services/datas.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

@Injectable()
export class HooksService {
  protected builder = builderGenerator<Hook>({
    allowed: [
      'id',
      'fk_model_id',
      'title',
      'event',
      'operation',
      'notification',
      'payload',
    ],
    mappings: {
      fk_model_id: 'table_id',
    },
    meta: {
      snakeCase: true,
      metaProps: ['notification'],
    },
  });

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly dataService: DatasService,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  async hookList(context: NcContext, param: { tableId: string }) {
    const list = await Hook.list(context, { fk_model_id: param.tableId });

    return this.builder().build(list);
  }
}
