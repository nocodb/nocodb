import { UITypes } from 'nocodb-sdk';
import type LinkToAnotherRecordColumn from '../../models/LinkToAnotherRecordColumn';
import SwaggerTypes from '../../db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import type Column from '../../models/Column';
import Noco from '../../Noco';
import type Project from '../../models/Project';

export default async (
  columns: Column[],
  project: Project,
  ncMeta = Noco.ncMeta
): Promise<SwaggerColumn[]> => {
  const dbType = await project.getBases().then((b) => b?.[0]?.type);
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
              ncMeta
            );
            if (colOpt) {
              const relTable = await colOpt.getRelatedTable(ncMeta);
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
    })
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
