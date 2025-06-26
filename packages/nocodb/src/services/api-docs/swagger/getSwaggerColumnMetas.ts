import { RelationTypes, UITypes } from 'nocodb-sdk';
import { FormulaDataTypes } from 'nocodb-sdk';
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
          // Extract type from parsed tree if available
          if (c.colOptions?.parsed_tree?.dataType) {
            const formulaDataType = c.colOptions.parsed_tree.dataType;
            switch (formulaDataType) {
              case FormulaDataTypes.NUMERIC:
                field.type = 'number';
                break;
              case FormulaDataTypes.STRING:
                field.type = 'string';
                break;
              case FormulaDataTypes.DATE:
                field.type = 'string';
                field.format = 'date-time';
                break;
              case FormulaDataTypes.BOOLEAN:
              case FormulaDataTypes.LOGICAL:
              case FormulaDataTypes.COND_EXP:
                field.type = 'boolean';
                break;
              case FormulaDataTypes.NULL:
              case FormulaDataTypes.UNKNOWN:
              default:
                field.type = 'string';
                break;
            }
          } else {
            // Fallback to string if no parsed tree available
            field.type = 'string';
          }
          break;
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
            type: 'object',
          };
          break;
        case UITypes.Checkbox:
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
          field.type = 'number';
          break;
        case UITypes.Date:
        case UITypes.DateTime:
        case UITypes.Time:
          field.type = 'string';
          field.format = c.uidt === UITypes.Date ? 'date' : 'date-time';
          break;
        case UITypes.Email:
          field.type = 'string';
          field.format = 'email';
          break;
        case UITypes.URL:
          field.type = 'string';
          field.format = 'uri';
          break;
        case UITypes.JSON:
          field.type = 'object';
          break;
        case UITypes.LastModifiedTime:
        case UITypes.CreatedTime:
          field.type = 'string';
          field.format = 'date-time';
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
  format?: string;
}
