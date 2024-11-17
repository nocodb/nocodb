import { Inject, Injectable, Logger } from '@nestjs/common';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import ejs from 'ejs';
import type { NcContext } from '~/interface/config';
import type { FormColumnType, HookType } from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { _transformSubmittedFormDataForEmail } from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import formSubmissionEmailTemplate from '~/utils/common/formSubmissionEmailTemplate';
import { FormView, Hook, Model, View } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

export const HANDLE_WEBHOOK = '__nc_handleHooks';

@Injectable()
export class HookHandlerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(HookHandlerService.name);
  private unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  public async handleHooks(
    context: NcContext,
    { hookName, prevData, newData, user, viewId, modelId, tnPath },
  ): Promise<void> {
    const view = await View.get(context, viewId);
    const model = await Model.get(context, modelId);

    // handle form view data submission
    if (
      (hookName === 'after.insert' || hookName === 'after.bulkInsert') &&
      view.type === ViewTypes.FORM
    ) {
      try {
        const formView = await view.getView<FormView>(context);

        const emails = Object.entries(JSON.parse(formView?.email) || {})
          .filter((a) => a[1])
          .map((a) => a[0]);

        if (emails?.length) {
          const { columns } = await FormView.getWithInfo(
            context,
            formView.fk_view_id,
          );
          const allColumns = await model.getColumns(context);
          const fieldById = columns.reduce(
            (o: Record<string, FormColumnType>, f: FormColumnType) => {
              return Object.assign(o, { [f.fk_column_id]: f });
            },
            {},
          );
          let order = 1;
          const filteredColumns = allColumns
            ?.map((c: ColumnType) => {
              return {
                ...c,
                fk_column_id: c.id,
                fk_view_id: formView.fk_view_id,
                ...(fieldById[c.id] ? fieldById[c.id] : {}),
                order: (fieldById[c.id] && fieldById[c.id].order) || order++,
                id: fieldById[c.id] && fieldById[c.id].id,
              };
            })
            .sort((a: ColumnType, b: ColumnType) => a.order - b.order)
            .filter(
              (f: ColumnType & FormColumnType) =>
                f.show &&
                f.uidt !== UITypes.Rollup &&
                f.uidt !== UITypes.Lookup &&
                f.uidt !== UITypes.Formula &&
                f.uidt !== UITypes.QrCode &&
                f.uidt !== UITypes.Barcode &&
                f.uidt !== UITypes.SpecificDBType,
            )
            .sort((a: ColumnType, b: ColumnType) => a.order - b.order)
            .map((c: ColumnType & FormColumnType) => {
              c.required = !!(c.required || 0);
              return c;
            });

          const transformedData = _transformSubmittedFormDataForEmail(
            newData,
            formView,
            filteredColumns,
          );
          (await NcPluginMgrv2.emailAdapter(false))?.mailSend({
            to: emails.join(','),
            subject: 'NocoDB Form',
            html: ejs.render(formSubmissionEmailTemplate, {
              data: transformedData,
              tn: tnPath,
              _tn: model.title,
            }),
          });
        }
      } catch (e) {
        this.logger.error({
          error: e,
          details: 'Error while sending form submission email',
          hookName,
        });
      }
    }

    const [event, operation] = hookName.split('.');
    const hooks = await Hook.list(context, {
      fk_model_id: modelId,
      event: event as HookType['event'],
      operation: operation as HookType['operation'],
    });
    for (const hook of hooks) {
      if (hook.active) {
        try {
          await this.jobsService.add(JobTypes.HandleWebhook, {
            context,
            hookId: hook.id,
            modelId,
            viewId,
            prevData,
            newData,
            user,
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

  onModuleInit(): any {
    this.unsubscribe = this.eventEmitter.on(HANDLE_WEBHOOK, async (arg) => {
      const { context, ...rest } = arg;
      return this.handleHooks(context, rest);
    });
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
