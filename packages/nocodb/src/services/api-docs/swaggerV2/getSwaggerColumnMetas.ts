import { UITypes } from 'nocodb-sdk';
import type { Base, Column, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';

export default async (
  context: NcContext,
  columns: Column[],
  base: Base,
  ncMeta = Noco.ncMeta,
): Promise<SwaggerColumn[]> => {
  const dbType = await base.getSources().then((b) => b?.[0]?.type);
  return Promise.all(
    columns.map(async (c) => {
      const field: SwaggerColumn = {
        title: c.title,
        type: 'object',
        virtual: true,
        column: c,
      };

      switch (c.uidt) {
        case UITypes.LinkToAnotherRecord:
          {
            const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(
              context,
              ncMeta,
            );
            if (colOpt) {
              const relTable = await colOpt.getRelatedTable(context, ncMeta);
              field.type = undefined;
              field.$ref = `#/components/schemas/${relTable.title}Request`;
            }
          }
          break;
        case UITypes.Lookup:
        case UITypes.Formula:
          field.type = 'object';
          break;
        case UITypes.Rollup:
        case UITypes.Links:
          field.type = 'number';
          break;
        case UITypes.Attachment:
          field.type = 'array';
          field.items = {
            $ref: `#/components/schemas/Attachment`,
          };
          break;
        case UITypes.User:
        case UITypes.Collaborator:
        case UITypes.CreatedBy:
        case UITypes.LastModifiedBy:
          field.type = 'object';
          break;
        case UITypes.Date:
        case UITypes.DateTime:
        case UITypes.Time:
        case UITypes.CreatedTime:
        case UITypes.LastModifiedTime:
        case UITypes.SingleLineText:
        case UITypes.LongText:
        case UITypes.Email:
        case UITypes.PhoneNumber:
        case UITypes.URL:
          field.virtual = false;
          field.type = 'string';
          break;
        case UITypes.Checkbox:
          field.virtual = false;
          field.type = 'boolean';
          break;
        case UITypes.Number:
        case UITypes.Decimal:
        case UITypes.Currency:
        case UITypes.Percent:
        case UITypes.Duration:
        case UITypes.Rating:
        case UITypes.Year:
        case UITypes.Count:
        case UITypes.ID:
        case UITypes.Order:
          field.virtual = false;
          field.type = 'number';
          break;
        case UITypes.JSON:
          field.virtual = false;
          field.type = 'object';
          break;
        default:
          field.virtual = false;
          SwaggerTypes.setSwaggerType(c, field, dbType);
          break;
      }

      return field;
    }),
  );
};

export interface SwaggerColumn {
  type: any;
  title: string;
  description?: string;
  virtual?: boolean;
  $ref?: any;
  column: Column;
  items?: any;
}
