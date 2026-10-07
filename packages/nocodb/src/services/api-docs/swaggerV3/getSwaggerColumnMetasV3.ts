import { ButtonActionsType, RelationTypes, UITypes } from 'nocodb-sdk';
import { FormulaDataTypes } from 'nocodb-sdk';
import type { SourcesMap } from '~/services/api-docs/types';
import type {
  Column,
  LinkToAnotherRecordColumn,
  Model,
  RollupColumn,
} from '~/models';
import type { NcContext } from '~/interface/config';
import type LookupColumn from '~/models/LookupColumn';
import { DriverClient } from '~/utils/nc-config';
import { Base } from '~/models';
import SwaggerTypes from '~/db/sql-mgr/code/routers/xc-ts/SwaggerTypes';
import Noco from '~/Noco';

// Same branch list and no-null rule as the pg numeric formula below; keeps the
// enum generated clients (progenitor) already have for these fields.
const setAsAnyType = (field: SwaggerColumn) => {
  field.type = undefined;
  field.anyOf = [
    { type: 'string' },
    { type: 'number' },
    { type: 'integer' },
    { type: 'boolean' },
    { type: 'object' },
  ];
};

// Relation types whose link cell holds a list of records.
const MULTI_RECORD_RELATIONS = [
  RelationTypes.HAS_MANY,
  RelationTypes.MANY_TO_MANY,
  RelationTypes.ONE_TO_MANY,
];

const linkIdSchema = {
  oneOf: [{ type: 'string' }, { type: 'number' }],
  description: 'Record identifier for linking',
};

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    display_name: { type: ['string', 'null'] },
  },
};

const SQL_DRIVERS: string[] = [
  DriverClient.MYSQL,
  DriverClient.MYSQL_LEGACY,
  'mariadb',
  DriverClient.PG,
  DriverClient.SQLITE,
];

// Fallback for drivers SwaggerTypes has no column-type table for.
const setSwaggerTypeFromUidt = (column: Column, field: SwaggerColumn) => {
  switch (column.uidt) {
    case UITypes.ID:
    case UITypes.Number:
    case UITypes.Rating:
    case UITypes.Year:
    case UITypes.AutoNumber:
      field.type = ['integer', 'null'];
      break;
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
      field.type = ['number', 'null'];
      break;
    case UITypes.Checkbox:
      field.type = ['boolean', 'null'];
      break;
    case UITypes.JSON:
      setAsAnyType(field);
      break;
    default:
      field.type = ['string', 'null'];
      break;
  }
};

// TODO: refactor and avoid duplication
// Helper function to process a single column and return its swagger field definition
async function processColumnToSwaggerField(
  context: NcContext,
  {
    column,
    base,
    sourcesMap,
    isLookupHelper = false,
    dbType,
  }: {
    column: Column;
    base: Base;
    sourcesMap: SourcesMap;
    isLookupHelper?: boolean;
    dbType: DriverClient;
  },
  ncMeta = Noco.ncMeta,
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
          ncMeta,
        );
        if (colOpt) {
          if (MULTI_RECORD_RELATIONS.includes(colOpt.type as RelationTypes)) {
            field.type = 'array';
            field.items = {
              type: 'object',
              properties: { id: linkIdSchema },
              required: ['id'],
            };
          } else {
            field.type = ['object', 'null'];
            field.properties = { id: linkIdSchema };
          }
          // Writable inline as `{id}` / `[{id}]`.
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
            // pg carries the IEEE error values as strings; no other dialect can
            // produce one. anyOf rather than a type array — generators handle a
            // branch list far better than a multi-type, and it matches how the
            // rest of this file expresses a union. No null branch — it survives
            // the 3.1 -> 3.0 downgrade verbatim and progenitor rejects it; and
            // `nullable` is no substitute, ajv won't compile it without `type`.
            if (dbType === DriverClient.PG) {
              field.type = undefined;
              field.anyOf = [{ type: 'number' }, { type: 'string' }];
              field.description =
                'Numeric formula result. Division by zero returns the string "Infinity", "-Infinity" or "NaN".';
            } else {
              field.type = ['number', 'null'];
            }
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
        const colOpt = await column.getColOptions<LookupColumn>(ncMeta);
        if (colOpt && !colOpt.error) {
          const lookupCol = await colOpt.getLookupColumn();
          if (lookupCol) {
            return await processColumnToSwaggerField(
              context,
              {
                column: lookupCol,
                base,
                dbType,
                sourcesMap,
                isLookupHelper: true,
              },
              ncMeta,
            );
          }
        }
        setAsAnyType(field);
      } else {
        // For main lookup processing, determine relation type and structure
        const colOpt = await column.getColOptions<LookupColumn>(ncMeta);
        if (colOpt && !colOpt.error) {
          const relationCol = await colOpt.getRelationColumn();
          if (!relationCol) {
            setAsAnyType(field);
            break;
          }
          const relationColOpt =
            await relationCol.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
          const { refContext } = await relationColOpt.getRelContext();

          const lookupCol = await colOpt.getLookupColumn();

          const refBase =
            !relationColOpt.fk_related_base_id ||
            base.id === relationColOpt.fk_related_base_id
              ? base
              : await Base.get(refContext, relationColOpt.fk_related_base_id);

          // Get the type of the lookup column by recursively processing it
          const lookupField = await processColumnToSwaggerField(
            refContext,
            {
              column: lookupCol,
              base: refBase,
              sourcesMap,
              isLookupHelper: true,
              dbType,
            },
            ncMeta,
          );

          // Determine if this is a single value or array based on relation type
          if (
            relationColOpt &&
            !MULTI_RECORD_RELATIONS.includes(
              relationColOpt.type as RelationTypes,
            )
          ) {
            // Single value lookup
            field.type = lookupField.type;
            field.format = lookupField.format;
            field.$ref = lookupField.$ref;
            field.items = lookupField.items;
            field.anyOf = lookupField.anyOf;
            field.properties = lookupField.properties;
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
                items: lookupField.items,
                properties: lookupField.properties,
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
      const colOptions = await column.getColOptions<RollupColumn>(ncMeta);
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
    case UITypes.User:
      field.type = ['array', 'null'];
      field.items = userSchema;
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
      field.properties = userSchema.properties;
      break;
    case UITypes.CreatedBy:
      field.type = 'object';
      field.properties = userSchema.properties;
      break;
    case UITypes.Button:
      field.type = ['object', 'null'];
      field.properties = {
        type: {
          type: 'string',
          enum: Object.values(ButtonActionsType),
        },
        label: { type: 'string' },
        url: { type: 'string' },
      };
      field.readOnly = true;
      break;
    case UITypes.QrCode:
    case UITypes.Barcode:
      // both set to any for now
      // not worth to handle atm
      setAsAnyType(field);
      break;
    case UITypes.Checkbox:
      // MySQL stores it as tinyint, but the API always returns a boolean.
      field.virtual = false;
      field.type = ['boolean', 'null'];
      break;
    default:
      field.virtual = false;
      if (SQL_DRIVERS.includes(dbType)) {
        SwaggerTypes.setSwaggerType('3.1', column, field, dbType);
      } else {
        setSwaggerTypeFromUidt(column, field);
      }
      break;
  }

  // Primary key columns are never nullable
  if (column.pk) {
    if (Array.isArray(field.type)) {
      field.type = field.type.filter((t) => t !== 'null');
      // If only one type remains, unwrap the array
      if (field.type.length === 1) {
        field.type = field.type[0];
      }
    }
  }

  return field;
}

export default async (
  context: NcContext,
  {
    columns,
    base,
    model,
    sourcesMap,
  }: {
    columns: Column[];
    base: Base;
    model: Model;
    sourcesMap: SourcesMap;
  },
  ncMeta = Noco.ncMeta,
): Promise<SwaggerColumn[]> => {
  const dbType = sourcesMap.get(model.source_id)?.type as DriverClient;

  return Promise.all(
    columns.map(async (c) => {
      return await processColumnToSwaggerField(
        context,
        {
          column: c,
          base,
          sourcesMap,
          isLookupHelper: false,
          dbType,
        },
        ncMeta,
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
  readOnly?: boolean;
}
