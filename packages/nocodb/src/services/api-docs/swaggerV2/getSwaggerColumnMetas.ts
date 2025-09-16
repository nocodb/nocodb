import { UITypes, RelationTypes } from 'nocodb-sdk';
import { FormulaDataTypes } from 'nocodb-sdk';
import type { Base, Column, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';
import LookupColumn from '~/models/LookupColumn';

// Helper function to recursively get the field type for lookup columns
async function getLookupFieldType(
  context: NcContext,
  column: Column,
  base: Base,
  ncMeta = Noco.ncMeta,
): Promise<Partial<SwaggerColumn>> {
  const field: Partial<SwaggerColumn> = {
    type: 'object',
    virtual: true,
  };

  // Extract dbtype based on column source
  const dbType = await base.getSources().then((sources) => {
    const sourceId = column.source_id;
    return sources.find((s) => s.id === sourceId)?.type || sources[0]?.type;
  });

  switch (column.uidt) {
    case UITypes.Lookup:
      {
        // Recursive lookup
        const colOpt = await column.getColOptions<LookupColumn>(context, ncMeta);
        if (colOpt) {
          const lookupCol = await colOpt.getLookupColumn(context);
          return await getLookupFieldType(context, lookupCol, base, ncMeta);
        }
        field.type = 'object';
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOpt = await column.getColOptions<LinkToAnotherRecordColumn>(
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
      // Extract type from parsed tree if available
      if (column.colOptions?.parsed_tree?.dataType) {
        const formulaDataType = column.colOptions.parsed_tree.dataType;
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
    case UITypes.Rollup:
      field.type = 'number';
      break;
    case UITypes.Links:
      field.type = 'integer';
      break;
    case UITypes.Attachment:
      field.type = 'array';
      field.items = {
        $ref: `#/components/schemas/Attachment`,
      };
      break;
    case UITypes.Email:
      field.type = 'string';
      field.format = 'email';
      break;
    case UITypes.URL:
      field.type = 'string';
      field.format = 'uri';
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
      SwaggerTypes.setSwaggerType(column, field, dbType);
      break;
  }

  return field;
}

export default async (
  context: NcContext,
  columns: Column[],
  base: Base,
  ncMeta = Noco.ncMeta,
): Promise<SwaggerColumn[]> => {
  // extract dbtype based on column source
  const dbType = await base.getSources().then((sources) => {
    const sourceId = columns[0]?.source_id;
    return sources.find((s) => s.id === sourceId)?.type || sources[0]?.type;
  });
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
          {
            const colOpt = await c.getColOptions<LookupColumn>(context, ncMeta);
            if (colOpt) {
              const relationCol = await colOpt.getRelationColumn(context);
              const lookupCol = await colOpt.getLookupColumn(context);
              const relationColOpt = await relationCol.getColOptions<LinkToAnotherRecordColumn>(context, ncMeta);
              
              // Get the type of the lookup column by recursively processing it
              const lookupField = await getLookupFieldType(context, lookupCol, base, ncMeta);
              
              // Determine if this is a single value or array based on relation type
              if (relationColOpt && (relationColOpt.type === RelationTypes.BELONGS_TO || relationColOpt.type === RelationTypes.ONE_TO_ONE)) {
                // Single value lookup
                field.type = lookupField.type;
                field.format = lookupField.format;
                field.$ref = lookupField.$ref;
                field.items = lookupField.items;
              } else {
                // Array lookup (HAS_MANY or MANY_TO_MANY)
                field.type = 'array';
                if (lookupField.$ref) {
                  field.items = { $ref: lookupField.$ref };
                } else {
                  field.items = {
                    type: lookupField.type,
                    format: lookupField.format
                  };
                }
              }
            } else {
              // Fallback to object if we can't determine the type
              field.type = 'object';
            }
          }
          break;
        case UITypes.Rollup:
          field.type = 'number';
          break;
        case UITypes.Links:
          field.type = 'integer';
          break;
        case UITypes.Attachment:
          field.type = 'array';
          field.items = {
            $ref: `#/components/schemas/Attachment`,
          };
          field.virtual = false;
          break;
        case UITypes.Email:
          field.type = 'string';
          field.format = 'email';
          field.virtual = false;
          break;
        case UITypes.URL:
          field.type = 'string';
          field.format = 'uri';
          field.virtual = false;
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
