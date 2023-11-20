import { Inject, Injectable } from '@nestjs/common';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import ejs from 'ejs';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { UserType } from 'nocodb-sdk';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import {
  _transformSubmittedFormDataForEmail,
  invokeWebhook,
} from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import formSubmissionEmailTemplate from '~/utils/common/formSubmissionEmailTemplate';
import { FormView, Hook, Model, View } from '~/models';

export const HANDLE_WEBHOOK = '__nc_handleHooks';

@Injectable()
export class HookHandlerService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: () => void;

  constructor(
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
  ) {}

  private async handleHooks({
    hookName,
    prevData,
    newData,
    user,
    viewId,
    modelId,
    tnPath,
  }: {
    hookName;
    prevData;
    newData;
    user: UserType;
    viewId: string;
    modelId: string;
    tnPath: string;
  }): Promise<void> {
    const view = await View.get(viewId);
    const model = await Model.get(modelId);

    // handle form view data submission
    if (
      (hookName === 'after.insert' || hookName === 'after.bulkInsert') &&
      view.type === ViewTypes.FORM
    ) {
      try {
        const formView = await view.getView<FormView>();
        const { columns } = await FormView.getWithInfo(formView.fk_view_id);
        const allColumns = await model.getColumns();
        const fieldById = columns.reduce(
          (o: Record<string, any>, f: Record<string, any>) => ({
            ...o,
            [f.fk_column_id]: f,
          }),
          {},
        );
        let order = 1;
        const filteredColumns = allColumns
          ?.map((c: Record<string, any>) => ({
            ...c,
            fk_column_id: c.id,
            fk_view_id: formView.fk_view_id,
            ...(fieldById[c.id] ? fieldById[c.id] : {}),
            order: (fieldById[c.id] && fieldById[c.id].order) || order++,
            id: fieldById[c.id] && fieldById[c.id].id,
          }))
          .sort(
            (a: Record<string, any>, b: Record<string, any>) =>
              a.order - b.order,
          )
          .filter(
            (f: Record<string, any>) =>
              f.show &&
              f.uidt !== UITypes.Rollup &&
              f.uidt !== UITypes.Lookup &&
              f.uidt !== UITypes.Formula &&
              f.uidt !== UITypes.QrCode &&
              f.uidt !== UITypes.Barcode &&
              f.uidt !== UITypes.SpecificDBType,
          )
          .sort(
            (a: Record<string, any>, b: Record<string, any>) =>
              a.order - b.order,
          )
          .map((c: Record<string, any>) => ({
            ...c,
            required: !!(c.required || 0),
          }));

        const emails = Object.entries(JSON.parse(formView?.email) || {})
          .filter((a) => a[1])
          .map((a) => a[0]);
        if (emails?.length) {
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
        console.log(e);
      }
    }

    try {
      const [event, operation] = hookName.split('.');
      const hooks = await Hook.list({
        fk_model_id: modelId,
        event,
        operation,
      });
      for (const hook of hooks) {
        if (hook.active) {
          invokeWebhook(hook, model, view, prevData, newData, user);
        }
      }
    } catch (e) {
      console.log('hooks :: error', hookName, e);
    }
  }

  onModuleInit(): any {
    this.unsubscribe = this.eventEmitter.on(
      HANDLE_WEBHOOK,
      this.handleHooks.bind(this),
    );
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
