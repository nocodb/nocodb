import { Inject, Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import { Column, Model, View } from '~/models';
import { NcError } from '~/helpers/ncError';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class ActionsService {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async triggerAction(
    context: NcContext,
    payload: {
      button_id: string;
      table_id: string;
      view_id: string;
    },
    req: NcRequest,
  ) {
    const col = await Column.get(context, {
      colId: payload.button_id,
    });

    if (!col) {
      NcError.notFound('Column not found');
    }

    const model = await Model.get(context, payload.table_id);
    if (!model || model.id !== col.fk_model_id) {
      NcError.notFound('Model not found');
    }

    const view = await View.get(context, payload.view_id);

    if (!view || payload.table_id !== view.fk_model_id) {
      NcError.notFound('View not found');
    }

    const job = await this.jobsService.add(JobTypes.ExecuteAction, {
      context,
      buttonId: payload.button_id,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncSiteUrl: req.ncSiteUrl,
      },
      tableId: payload.table_id,
      viewId: payload.view_id,
    });

    return {
      id: job.id,
      name: job.name,
    };
  }
}
