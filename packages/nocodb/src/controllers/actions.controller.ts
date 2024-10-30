import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ButtonActionsType, UITypes } from 'nocodb-sdk';
import type { ButtonType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Model } from '~/models';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';
import { HooksService } from '~/services/hooks.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ActionsController {
  constructor(
    private readonly aiDataService: AiDataService,
    private readonly hooksService: HooksService,
  ) {}

  @Post(['/api/v2/tables/:tableId/button/:columnId'])
  @Acl('columnGet')
  async triggerButton(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('columnId') columnId: string,
    @Body()
    body: {
      customRows?: any[];
      rowIds?: string[];
    },
    @Req() req: NcRequest,
  ) {
    if (!body.customRows && !body.rowIds) {
      NcError.badRequest(`customRows or rowIds is required`);
    }

    if (body.customRows && body.rowIds) {
      NcError.badRequest(`customRows and rowIds can't be used together`);
    }

    const model = await Model.get(context, tableId);

    if (!model) {
      NcError.tableNotFound(tableId);
    }

    await model.getColumns(context);

    const column = model.columns.find((c) => c.id === columnId);

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    if (column.uidt !== UITypes.Button) {
      NcError.badRequest(
        `You can only trigger '${UITypes.Button}' type fields`,
      );
    }

    const buttonOptions = (await column.getColOptions(context)) as ButtonType;

    if (!buttonOptions) {
      NcError.badRequest(`Button is not configured properly`);
    }

    const rows = [];
    const rowIds = [];

    if (body.customRows) {
      if (buttonOptions.type === ButtonActionsType.Webhook) {
        NcError.notImplemented('', {
          customMessage: `Webhook button can't be triggered with custom rows`,
        });
      }

      rows.push(...body.customRows);
    } else {
      rowIds.push(...body.rowIds);
    }

    const response: {
      success: boolean;
      data?: any;
    } = {
      success: true,
    };

    switch (buttonOptions.type) {
      case ButtonActionsType.Url:
        NcError.badRequest(`You can't trigger URL type buttons`);
        break;
      case ButtonActionsType.Ai:
        {
          response.data = await this.aiDataService.generateRows(context, {
            modelId: tableId,
            columnId,
            ...(body.customRows ? { rows } : { rowIds }),
            req,
          });
        }
        break;
      case ButtonActionsType.Webhook:
        {
          response.data = [];
          for (const pk of rowIds) {
            response.data.push(
              await this.hooksService.hookTrigger(context, {
                hookId: buttonOptions.fk_webhook_id,
                rowId: pk,
                req,
              }),
            );
          }
        }
        break;
      default:
        NcError.badRequest(`Button is not configured properly`);
        break;
    }

    return response;
  }
}
