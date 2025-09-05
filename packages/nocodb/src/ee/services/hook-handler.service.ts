import { Inject, Injectable } from '@nestjs/common';
import { HookHandlerService as HookHandlerServiceCE } from 'src/services/hook-handler.service';
import { type HookType, WebhookEvents } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { JobTypes } from '~/interface/Jobs';
import { Hook } from '~/models';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class HookHandlerService extends HookHandlerServiceCE {
  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly mailService: MailService,
  ) {
    super(eventEmitter, jobsService, mailService);
  }

  override async handleViewHooks(
    context: NcContext,
    param: { hookName; prevData; newData; user; modelId },
  ) {
    const { hookName, prevData, newData, user, modelId } = param;
    const [event, operation] = hookName.split('.');

    const hooks = await Hook.list(context, {
      fk_model_id: modelId,
      event: event as HookType['event'],
      operation: operation as HookType['operation'][0],
    });
    for (const hook of hooks) {
      if (hook.active) {
        try {
          await this.jobsService.add(JobTypes.HandleWebhook, {
            context,
            hookId: hook.id,
            modelId,
            prevData,
            newData,
            user,
            hookName,
            ncSiteUrl: context.nc_site_url,
          });
        } catch (e) {
          this.logger.error({
            error: e,
            details: 'Error while invoking webhook',
            hook: hook.id,
          });
        }
      }
    }
  }
  override async handleHooks(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    const { hookName } = param;
    const [event] = hookName.split('.');

    if (event === WebhookEvents.VIEW) {
      return this.handleViewHooks(context, param);
    }

    return super.handleHooks(context, param);
  }
}
