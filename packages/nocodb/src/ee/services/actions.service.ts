import { Inject, Injectable } from '@nestjs/common';
import { ButtonActionsType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import { ButtonColumn, Model, Script, View } from '~/models';
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
    const buttonColumn = await ButtonColumn.read(context, payload.button_id);
    if (!buttonColumn || buttonColumn.type !== ButtonActionsType.Script) {
      NcError.notFound('Button column not found');
    }

    const model = await Model.get(context, payload.table_id);
    if (!model) {
      NcError.notFound('Model not found');
    }

    const view = await View.get(context, payload.view_id);

    if (!view || payload.table_id !== view.fk_model_id) {
      NcError.notFound('View not found');
    }

    const script = await Script.get(context, buttonColumn.fk_script_id);

    const job = await this.jobsService.add(JobTypes.ExecuteAction, {
      context,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncSiteUrl: req.ncSiteUrl,
      },
      scriptId: script.id,
      modelId: model.id,
      viewId: view.id,
    });

    return {
      id: job.id,
      name: JobTypes.ExecuteAction,
    };
  }
}
