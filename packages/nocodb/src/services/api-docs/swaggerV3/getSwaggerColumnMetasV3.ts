import { RelationTypes, UITypes } from 'nocodb-sdk';
import { FormulaDataTypes } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type LookupColumn from '~/models/LookupColumn';
import type { DriverClient } from '~/utils/nc-config';
import { Base } from '~/models';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';

// TODO: refactor and avoid duplication
// Helper function to process a single column and return its swagger field definition
async function processColumnToSwaggerField(
  context: NcContext,
  column: Column,
  base: Base,
  ncMeta = Noco.ncMeta,
  isLookupHelper = false,
  dbType: DriverClient,
): Promise<SwaggerColumn> {
  const field: SwaggerColumn = {
    title: column.title,
    type: 'object',
    virtual: true,
    column,
  };

  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
      {
        const colOpt = await column.getColOptions<LinkToAnotherRecordColumn>(
          context,
          ncMeta,
        );
        if (colOpt) {
          // LTAR fields in insert/update accept array of objects with id property
          field.type = 'array';
          field.items = {
            type: 'object',
            properties: {
              id: {
                oneOf: [{ type: 'string' }, { type: 'number' }],
                description: 'Record identifier for linking',
              },
            },
            required: ['id'],
          };
          field.virtual = false;
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
    case UITypes.Lookup:
      if (isLookupHelper) {
        // For recursive lookup resolution, get the underlying column type
        const colOpt = await column.getColOptions<LookupColumn>(
          context,
          ncMeta,
        );
        if (colOpt) {
          const lookupCol = await colOpt.getLookupColumn(context);
          return await processColumnToSwaggerField(
            context,
            lookupCol,
            base,
            ncMeta,
            true,
            dbType,
          );
        }
        field.type = 'object';
      } else {
        // For main lookup processing, determine relation type and structure
        const colOpt = await column.getColOptions<LookupColumn>(
          context,
          ncMeta,
        );
        if (colOpt) {
          const relationCol = await colOpt.getRelationColumn(context);
          const relationColOpt =
            await relationCol.getColOptions<LinkToAnotherRecordColumn>(
              context,
              ncMeta,
            );
          const { refContext } = await relationColOpt.getRelContext(context);

          const lookupCol = await colOpt.getLookupColumn(refContext);

          const refBase =
            !relationColOpt.fk_related_base_id ||
            base.id === relationColOpt.fk_related_base_id
              ? base
              : await Base.get(refContext, relationColOpt.fk_related_base_id);

          // Get the type of the lookup column by recursively processing it
          const lookupField = await processColumnToSwaggerField(
            refContext,
            lookupCol,
            refBase,
            ncMeta,
            true,
            dbType,
          );

          // Determine if this is a single value or array based on relation type
          if (
            relationColOpt &&
            (relationColOpt.type === RelationTypes.BELONGS_TO ||
              relationColOpt.type === RelationTypes.ONE_TO_ONE)
          ) {
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
                format: lookupField.format,
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
      field.type = ['string', 'null'];
      field.format = 'date-time';
      break;
    case UITypes.CreatedTime:
      field.type = 'string';
      field.format = 'date-time';
      break;
    case UITypes.LastModifiedBy:
      field.type = ['object', 'null'];
      break;
    case UITypes.CreatedBy:
      field.type = 'object';
      break;
    default:
      field.virtual = false;
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
  // Extract dbtype based on column source
  const dbType = await base.getSources().then((sources) => {
    const sourceId = columns[0]?.source_id;
    return sources.find((s) => s.id === sourceId)?.type || sources[0]?.type;
  });

  return Promise.all(
    columns.map(async (c) => {
      return await processColumnToSwaggerField(
        context,
        c,
        base,
        ncMeta,
        false,
        dbType,
      );
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
