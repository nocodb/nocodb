import { parseProp, RelationTypes, UITypes } from 'nocodb-sdk';
import { FormulaDataTypes } from 'nocodb-sdk';
import type { Column, LinkToAnotherRecordColumn, RollupColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import type LookupColumn from '~/models/LookupColumn';
import type { DriverClient } from '~/utils/nc-config';
import { Base } from '~/models';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';

const setAsAnyType = (field: SwaggerColumn, nullable = true) => {
  const result = field as any;
  result.nullable = nullable;
  result.type = undefined;
  result.anyOf = [
    { type: 'string' },
    { type: 'number' },
    { type: 'integer' },
    { type: 'boolean' },
    { type: 'object' },
  ];
};

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
          if (
            [RelationTypes.HAS_MANY, RelationTypes.MANY_TO_MANY].includes(
              colOpt.type as RelationTypes,
            )
          ) {
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
          } else {
            field.type = ['object', 'null'];
            field.properties = {
              id: {
                oneOf: [{ type: 'string' }, { type: 'number' }],
                description: 'Record identifier for linking',
              },
            };
          }
        }
      }
      break;
    case UITypes.Formula:
      // Extract type from parsed tree if available
      if (column.colOptions?.parsed_tree?.dataType) {
        const formulaDataType = column.colOptions.parsed_tree.dataType;
        switch (formulaDataType) {
          case FormulaDataTypes.NUMERIC:
            field.type = ['number', 'null'];
            break;
          case FormulaDataTypes.STRING:
            field.type = ['string', 'null'];
            break;
          case FormulaDataTypes.DATE:
            field.type = ['string', 'null'];
            field.format = 'date-time';
            break;
          case FormulaDataTypes.BOOLEAN:
          case FormulaDataTypes.LOGICAL:
          case FormulaDataTypes.COND_EXP:
            field.type = ['boolean', 'null'];
            break;
          case FormulaDataTypes.NULL:
          case FormulaDataTypes.UNKNOWN:
          default:
            // Fallback to any if type not handled
            setAsAnyType(field);
            break;
        }
      } else {
        // Fallback to any if no parsed tree available
        setAsAnyType(field);
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
        setAsAnyType(field);
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
            field.anyOf = lookupField.anyOf;
          } else {
            // Array lookup (HAS_MANY or MANY_TO_MANY)
            field.type = 'array';
            if (lookupField.$ref) {
              field.items = { $ref: lookupField.$ref };
            } else {
              field.items = {
                type: lookupField.type,
                format: lookupField.format,
                anyOf: lookupField.anyOf,
              };
            }
          }
        } else {
          // Fallback to object if we can't determine the type
          setAsAnyType(field);
        }
      }
      break;
    case UITypes.Rollup: {
      const colOptions = await column.getColOptions<RollupColumn>(
        context,
        ncMeta,
      );
      if (!['max', 'min'].includes(colOptions.rollup_function.toLowerCase())) {
        field.type = 'number';
      } else {
        // if min or max, let it be any
        setAsAnyType(field);
      }
      break;
    }
    case UITypes.Links:
      field.type = 'integer';
      break;
    case UITypes.Attachment:
      field.type = ['array', 'null'];
      field.items = {
        $ref: `#/components/schemas/Attachment`,
      };
      field.virtual = false;
      break;
    case UITypes.MultiSelect:
      field.type = ['array', 'null'];
      field.items = {
        type: 'string',
      };
      field.virtual = false;
      break;
    case UITypes.Email:
      field.type = ['string', 'null'];
      field.format = 'email';
      field.virtual = false;
      break;
    case UITypes.URL:
      field.type = ['string', 'null'];
      field.format = 'uri';
      field.virtual = false;
      break;
    case UITypes.User: {
      const userProperties = {
        id: { type: 'string' },
        email: { type: 'string' },
        display_name: { type: ['string', 'null'] },
      };
      if (parseProp(column.meta).is_multi) {
        field.type = ['array', 'null'];
        field.items = {
          type: 'object',
          properties: userProperties,
        };
      } else {
        field.type = ['object', 'null'];
        field.properties = userProperties;
      }
      field.virtual = false;
      break;
    }
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
    case UITypes.QrCode:
    case UITypes.Barcode:
      // both set to any for now
      // not worth to handle atm
      setAsAnyType(field);
      break;
    default:
      field.virtual = false;
      SwaggerTypes.setSwaggerType('3.1', column, field, dbType);
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
  properties?: any;
  format?: string;
  anyOf?: any[];
}
