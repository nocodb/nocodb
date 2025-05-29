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
        case UITypes.Formula:
        case UITypes.Lookup:
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
        case UITypes.LastModifiedTime:
        case UITypes.CreatedTime:
          field.type = 'string';
          break;
        case UITypes.LastModifiedBy:
        case UITypes.CreatedBy:
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
