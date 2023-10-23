import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { Base, Column, LinkToAnotherRecordColumn } from '~/models';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';

export default async (
  columns: Column[],
  base: Base,
  ncMeta = Noco.ncMeta,
): Promise<SwaggerColumn[]> => {
  const dbType = await base.getBases().then((b) => b?.[0]?.type);
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
              ncMeta,
            );
            if (colOpt) {
              const relTable = await colOpt.getRelatedTable(ncMeta);
              if (colOpt.type === RelationTypes.BELONGS_TO) {
                field.type = undefined;
                field.$ref = `#/components/schemas/${relTable.title}Request`;
              } else {
                field.type = 'array';
                field.items = {
                  $ref: `#/components/schemas/${relTable.title}Request`,
                };
              }
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
