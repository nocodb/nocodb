import { Injectable } from '@nestjs/common';
import { isSystemColumn, UITypes, ColumnHelper } from 'nocodb-sdk';
import type { ColumnType, NcContext, NcRequest, TableType } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { Base, BaseUser, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { extractDisplayNameFromEmail } from '~/utils';
import { DataTableService } from '~/services/data-table.service';

interface SendRecordEmailPayload {
  tableId: string;
  viewId?: string;
  rowId: string;
  emails: string[];
  message?: string;
  sendCopyToSelf?: boolean;
}

@Injectable()
export class SendRecordEmailOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly mailService: MailService,
    protected readonly dataTableService: DataTableService,
  ) {}

  operations = ['sendRecordEmail' as const];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      operation,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: SendRecordEmailPayload;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'sendRecordEmail':
        return await this.sendRecordEmail(context, payload, req);
    }
  }

  private async sendRecordEmail(
    context: NcContext,
    payload: SendRecordEmailPayload,
    req: NcRequest,
  ) {
    const { tableId, viewId, rowId, emails, message, sendCopyToSelf } = payload;

    if (!emails || emails.length === 0) {
      NcError.get(context).badRequest(
        'At least one recipient email is required',
      );
    }

    if (emails.length > 15) {
      NcError.get(context).badRequest('Maximum 15 recipients allowed');
    }

    const user = req.user;
    const senderName = extractDisplayNameFromEmail(
      user.email,
      user.display_name,
    );
    const senderEmail = user.email;

    const model = await Model.get(context, tableId);
    if (!model) {
      NcError.get(context).tableNotFound(tableId);
    }

    const base = await Base.get(context, model.base_id);

    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: base.id,
      mode: 'full',
    });

    const baseUserEmails = baseUsers.map((u) => u.email?.toLowerCase());

    const finalEmails = [...emails];
    if (sendCopyToSelf && senderEmail && !finalEmails.includes(senderEmail)) {
      if (baseUserEmails.includes(senderEmail.toLowerCase())) {
        finalEmails.push(senderEmail);
      }
    }

    const invalidEmails: string[] = [];
    for (const email of finalEmails) {
      if (!baseUserEmails.includes(email.toLowerCase())) {
        invalidEmails.push(email);
      }
    }

    if (invalidEmails.length > 0) {
      NcError.get(context).badRequest(
        `The following email(s) are not members of this base: ${invalidEmails.join(', ')}`,
      );
    }

    const row = await this.dataTableService.dataRead(context, {
      baseId: context.base_id,
      modelId: tableId,
      rowId,
      viewId,
      query: {},
    });

    if (!row) {
      NcError.get(context).recordNotFound(rowId);
    }

    const source = await Source.get(context, model.source_id);
    const columns = await model.getColumns(context);

    const filteredColumns = columns.filter(
      (col: ColumnType) =>
        !isSystemColumn(col) &&
        col.uidt !== UITypes.QrCode &&
        col.uidt !== UITypes.Barcode,
    );

    const models = await source.getModels(context);
    const metas = models.reduce(
      (o: Record<string, TableType>, m: TableType) => {
        return Object.assign(o, { [m.id]: m });
      },
      {},
    );

    const recordData = this.transformDataForEmail(
      row,
      filteredColumns,
      source,
      model,
      metas,
    );

    const result = await this.mailService.sendMail({
      mailEvent: MailEvent.SEND_RECORD,
      payload: {
        senderName,
        senderEmail,
        emails: finalEmails,
        model,
        base,
        message,
        recordData,
        rowId,
        req,
      },
    });

    if (!result) {
      NcError.get(context).internalServerError(
        'Failed to send email. Please check your email configuration.',
      );
    }

    return { msg: 'Record sent successfully' };
  }

  private transformDataForEmail(
    data: Record<string, any>,
    columns: ColumnType[],
    source: Source,
    model: Model,
    models: Record<string, TableType>,
  ): Array<{
    parsedValue?: any;
    columnTitle: string;
    uidt: UITypes | string;
  }> {
    const transformedData: Array<{
      parsedValue?: any;
      columnTitle: string;
      uidt: UITypes | string;
    }> = [];

    for (const col of columns) {
      let serializedValue: string | undefined;

      try {
        serializedValue = ColumnHelper.parsePlainCellValue(data[col.title], {
          col,
          isMysql: () => source.type.startsWith('mysql'),
          isPg: () => source.type === 'pg',
          isXcdbBase: () => !!source.isMeta(),
          meta: model,
          metas: models,
        });

        if (col.uidt === UITypes.Attachment) {
          let attachments = data[col.title] || [];
          if (typeof data[col.title] === 'string') {
            try {
              attachments = JSON.parse(data[col.title]);
            } catch {
              attachments = [];
            }
          }
          serializedValue = Array.isArray(attachments)
            ? attachments
                .map((attachment: any) => attachment?.title || '')
                .filter(Boolean)
                .join(', ')
            : '';
        }
      } catch {
        serializedValue = data[col.title]?.toString() || '';
      }

      if (serializedValue !== undefined && serializedValue !== '') {
        transformedData.push({
          parsedValue: serializedValue,
          uidt: col.uidt,
          columnTitle: col.title,
        });
      }
    }

    return transformedData;
  }
}
