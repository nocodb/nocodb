import UITypes from '~/lib/UITypes';
import { isSystemColumn } from '~/lib/helperFunctions';
import {
  VariableDefinition,
  VariableGroupKey,
  VariableType,
} from '~/lib/workflow/interface';
import { RelationTypes } from '~/lib/globals';
import { ColumnType } from '~/lib';
import { LinkToAnotherRecordType, LookupType } from '~/lib/Api';
import { FormulaDataTypes } from '~/lib/formula/enums';

/**
 * Context interface for async operations
 */
export interface VariableGeneratorContext {
  getColumn?: (columnId: string) => Promise<ColumnType> | ColumnType;
  getTableColumns?: (tableId: string) => Promise<ColumnType[]> | ColumnType[];
  port?: string; // Current port for multi-port nodes (e.g., 'body', 'output' for iterate node)
}

/**
 * Map UIType to icon name (matching NocoDB's iconMap)
 */
export function uiTypeToIcon(column: ColumnType): string {
  switch (column.uidt) {
    case UITypes.ID:
    case UITypes.ForeignKey:
      return 'cellSystemKey';
    case UITypes.SingleLineText:
      return 'cellText';
    case UITypes.LongText:
      return 'cellLongText';
    case UITypes.Email:
      return 'cellEmail';
    case UITypes.URL:
      return 'cellUrl';
    case UITypes.PhoneNumber:
      return 'cellPhone';
    case UITypes.Number:
      return 'cellNumber';
    case UITypes.Decimal:
      return 'cellDecimal';
    case UITypes.Currency:
      return 'cellCurrency';
    case UITypes.Percent:
      return 'cellPercent';
    case UITypes.Duration:
      return 'cellDuration';
    case UITypes.Rating:
      return 'cellRating';
    case UITypes.Checkbox:
      return 'cellCheckbox';
    case UITypes.Date:
      return 'cellDate';
    case UITypes.DateTime:
      return 'cellDatetime';
    case UITypes.Time:
      return 'cellTime';
    case UITypes.Year:
      return 'cellYear';
    case UITypes.Attachment:
      return 'cellAttachment';
    case UITypes.SingleSelect:
      return 'cellSingleSelect';
    case UITypes.MultiSelect:
      return 'cellMultiSelect';
    case UITypes.Collaborator:
    case UITypes.User:
      return 'cellUser';
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy:
      return 'cellSystemUser';
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return 'cellSystemDate';
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links: {
      const relationType = (column.colOptions as LinkToAnotherRecordType).type;
      if (relationType === RelationTypes.HAS_MANY) {
        return 'hm_solid';
      } else if (relationType === RelationTypes.MANY_TO_MANY) {
        return 'mm_solid';
      } else if (relationType === RelationTypes.BELONGS_TO) {
        return 'bt_solid';
      } else if (relationType === RelationTypes.ONE_TO_ONE) {
        return 'oneToOneSolid';
      }
      return 'mmSolid';
    }
    case UITypes.Lookup:
      return 'cellLookup';
    case UITypes.Rollup:
      return 'cellRollup';
    case UITypes.Formula:
      return 'cellFormula';
    case UITypes.Count:
    case UITypes.AutoNumber:
      return 'cellNumber';
    case UITypes.Barcode:
      return 'cellBarcode';
    case UITypes.QrCode:
      return 'cellQrCode';
    case UITypes.GeoData:
      return 'ncMapPin';
    case UITypes.Geometry:
      return 'cellGeometry';
    case UITypes.JSON:
      return 'cellJson';
    case UITypes.Button:
      return 'cellButton';
    case UITypes.SpecificDBType:
      return 'cellDb';
    default:
      return 'cellSystemText';
  }
}

/**
 * Map Formula data types to VariableType
 */
function formulaDataTypeToVariableType(
  formulaDataType: FormulaDataTypes
): VariableType {
  switch (formulaDataType) {
    case FormulaDataTypes.NUMERIC:
      return VariableType.Number;
    case FormulaDataTypes.STRING:
      return VariableType.String;
    case FormulaDataTypes.DATE:
      return VariableType.DateTime;
    case FormulaDataTypes.BOOLEAN:
    case FormulaDataTypes.LOGICAL:
      return VariableType.Boolean;
    case FormulaDataTypes.COND_EXP:
      return VariableType.String;
    case FormulaDataTypes.NULL:
    case FormulaDataTypes.UNKNOWN:
      return VariableType.String;
    default:
      return VariableType.Object; // Fallback for unknown types
  }
}

/**
 * Convert NocoDB UIType to VariableType
 * Note: For Lookup fields, this returns a generic Object type.
 * Use resolveLookupType() for accurate type resolution.
 */
export function uiTypeToVariableType(
  uiType: UITypes,
  columnMeta?: any
): { type: VariableType; isArray: boolean } {
  switch (uiType) {
    // Formula - resolve actual type from parsed tree
    case UITypes.Formula: {
      const parsedTree = columnMeta?.parsed_tree;
      if (parsedTree?.dataType) {
        const formulaType = formulaDataTypeToVariableType(parsedTree.dataType);
        return { type: formulaType, isArray: false };
      }
      // Fallback if no parsed tree available
      return { type: VariableType.String, isArray: false };
    }

    // Number types
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Rollup:
    case UITypes.AutoNumber:
    case UITypes.Count:
      return { type: VariableType.Number, isArray: false };

    // Integer type
    case UITypes.Links:
      return { type: VariableType.Integer, isArray: false };

    // Boolean types
    case UITypes.Checkbox:
      return { type: VariableType.Boolean, isArray: false };

    // DateTime types
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.Time:
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
      return { type: VariableType.DateTime, isArray: false };

    // Array types
    case UITypes.Attachment:
      return { type: VariableType.Object, isArray: true };

    case UITypes.MultiSelect:
      return { type: VariableType.String, isArray: true };

    // Object types
    case UITypes.LinkToAnotherRecord: {
      // Check relation type from columnMeta
      const isMultiple =
        columnMeta?.type === RelationTypes.HAS_MANY ||
        columnMeta?.type === RelationTypes.MANY_TO_MANY;
      return { type: VariableType.Object, isArray: isMultiple };
    }
    case UITypes.User:
    case UITypes.Collaborator: {
      return { type: VariableType.Object, isArray: true };
    }

    case UITypes.LastModifiedBy:
    case UITypes.CreatedBy:
      return { type: VariableType.Object, isArray: false };

    case UITypes.JSON:
      return { type: VariableType.Object, isArray: false };

    case UITypes.Lookup: {
      return { type: VariableType.Object, isArray: false };
    }

    // String types (default)
    case UITypes.SingleLineText:
    case UITypes.LongText:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.PhoneNumber:
    case UITypes.SingleSelect:
    case UITypes.Year:
    case UITypes.GeoData:
    case UITypes.Geometry:
    case UITypes.Barcode:
    case UITypes.QrCode:
    case UITypes.Button:
    case UITypes.SpecificDBType:
    case UITypes.ID:
    case UITypes.ForeignKey:
    default:
      return { type: VariableType.String, isArray: false };
  }
}

/**
 * Recursively resolve the actual type of a Lookup field
 * This follows the same logic as the Swagger V3 generator
 */
async function resolveLookupType(
  column: ColumnType,
  context?: VariableGeneratorContext,
  visitedColumnIds: Set<string> = new Set()
): Promise<{ type: VariableType; isArray: boolean }> {
  // Prevent infinite recursion
  if (visitedColumnIds.has(column.id)) {
    return { type: VariableType.Object, isArray: false };
  }
  visitedColumnIds.add(column.id);

  const lookupOptions = column.colOptions as LookupType;
  if (!lookupOptions) {
    return { type: VariableType.Object, isArray: false };
  }

  try {
    // Get the relation column to determine if it's an array
    const relationColumnId = lookupOptions.fk_relation_column_id;
    const lookupColumnId = lookupOptions.fk_lookup_column_id;

    if (!relationColumnId || !lookupColumnId || !context?.getColumn) {
      // Fallback if we can't resolve
      return { type: VariableType.Object, isArray: false };
    }

    // Get the relation column
    const relationColumn = await context.getColumn(relationColumnId);
    const relationOptions =
      relationColumn?.colOptions as LinkToAnotherRecordType;

    // Determine if this is an array lookup based on relation type
    const isArrayRelation =
      relationOptions?.type === RelationTypes.HAS_MANY ||
      relationOptions?.type === RelationTypes.MANY_TO_MANY;

    // Get the lookup target column
    const lookupColumn = await context.getColumn(lookupColumnId);
    if (!lookupColumn) {
      return { type: VariableType.Object, isArray: isArrayRelation };
    }

    // Recursively resolve the type of the lookup target
    let targetType: { type: VariableType; isArray: boolean };

    if (lookupColumn.uidt === UITypes.Lookup) {
      // Nested lookup - recurse
      targetType = await resolveLookupType(
        lookupColumn,
        context,
        visitedColumnIds
      );
    } else {
      // Base case - get the type of the target column
      targetType = uiTypeToVariableType(
        lookupColumn.uidt as UITypes,
        lookupColumn.colOptions
      );
    }

    // If the relation is an array, the lookup result is also an array
    // (even if the target column itself is not an array)
    if (isArrayRelation) {
      return { type: targetType.type, isArray: true };
    }

    // Otherwise, return the target type as-is
    return targetType;
  } catch (error) {
    // Fallback on error
    return { type: VariableType.Object, isArray: false };
  }
}

/**
 * Helper to safely build a property accessor (dot notation or bracket notation)
 * Uses bracket notation if the property name contains spaces or special characters
 */
function buildPropertyKey(prefix: string, propertyName: string): string {
  // Check if property name needs bracket notation
  // Use bracket notation if it contains spaces, starts with a number, or has special chars
  const needsBrackets =
    /[^a-zA-Z0-9_$]/.test(propertyName) || /^\d/.test(propertyName);

  if (needsBrackets) {
    return `${prefix}['${propertyName}']`;
  } else {
    return `${prefix}.${propertyName}`;
  }
}

/**
 * Generate variable definition from NocoDB column
 */
export async function getFieldVariable(
  column: ColumnType,
  prefix: string = 'fields',
  context?: VariableGeneratorContext
): Promise<VariableDefinition> {
  let type: VariableType;
  let isArray: boolean;
  let itemType: VariableType | undefined;

  if (column.uidt === UITypes.Lookup && context) {
    // For Lookup fields, resolve the actual type
    const resolvedType = await resolveLookupType(column, context);
    if (resolvedType.isArray) {
      type = VariableType.Array;
      isArray = true;
      itemType = resolvedType.type;
    } else {
      type = resolvedType.type;
      isArray = false;
    }
  } else {
    // For other fields, use the standard type mapping
    const typeInfo = uiTypeToVariableType(
      column.uidt as UITypes,
      column.colOptions
    );
    type = typeInfo.type;
    isArray = typeInfo.isArray;
  }

  const variable: VariableDefinition = {
    key: buildPropertyKey(prefix, column.title),
    name: column.title,
    type,
    groupKey: VariableGroupKey.Fields,
    isArray,
    extra: {
      entity_id: column.id,
      entity: 'column',
      uiType: column.uidt,
      icon: uiTypeToIcon(column),
    },
  };

  // For array Lookup fields, add itemSchema with the item type
  if (column.uidt === UITypes.Lookup && isArray && itemType) {
    variable.extra = {
      ...variable.extra,
      itemSchema: [
        {
          key: '',
          name: 'Item',
          type: itemType,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: uiTypeToIcon(column),
          },
        },
      ],
    };
  }

  // Handle LTAR fields - add structure for id and fields properties
  if (column.uidt === UITypes.LinkToAnotherRecord) {
    const ltarOptions = column.colOptions as LinkToAnotherRecordType;
    const relatedTableId = ltarOptions?.fk_related_model_id;

    // Try to get related table's primary value column if context provides it
    let pvFieldVariable: VariableDefinition | undefined;
    if (relatedTableId && context?.getTableColumns) {
      try {
        const relatedColumns = await context.getTableColumns(relatedTableId);

        // Find the primary value (display) column
        const pvColumn =
          relatedColumns.find((col) => col.pv) ||
          relatedColumns.find((col) => col.pk);

        if (pvColumn) {
          // Generate field variable for the PV column only
          pvFieldVariable = await getFieldVariable(pvColumn, 'fields', context);
        }
      } catch (error) {
        // If we can't get related columns, continue without PV field
        pvFieldVariable = undefined;
      }
    }

    const recordStructure: VariableDefinition[] = [
      {
        key: 'id',
        name: 'ID',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellSystemKey',
        },
      },
      {
        key: 'fields',
        name: 'Fields',
        type: VariableType.Object,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellJson',
        },
        children: pvFieldVariable ? [pvFieldVariable] : undefined,
      },
    ];

    if (isArray) {
      // For array LTAR, add itemSchema showing each item has id and fields
      variable.extra = {
        ...variable.extra,
        itemSchema: recordStructure,
      };
    } else {
      // For single LTAR, add id and fields as children
      variable.children = recordStructure.map((child) => ({
        ...child,
        key: `${variable.key}.${child.key}`,
        children: child.children
          ? child.children.map((nestedChild) => ({
              ...nestedChild,
              key: `${variable.key}.${child.key}.${nestedChild.key}`,
            }))
          : undefined,
      }));
    }
  }

  if (column.uidt === UITypes.Attachment && isArray) {
    // Define the structure of each attachment item
    variable.extra = {
      ...variable.extra,
      itemSchema: [
        {
          key: 'url',
          name: 'URL',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellUrl',
            description: 'URL',
          },
        },
        {
          key: 'signedUrl',
          name: 'Signed URL',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellUrl',
            description: 'Signed URL',
          },
        },
        {
          key: 'title',
          name: 'Title',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'Title',
          },
        },
        {
          key: 'mimetype',
          name: 'MimeType',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'MIME type',
          },
        },
        {
          key: 'size',
          name: 'Size',
          type: VariableType.Number,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellNumber',
            description: 'Size',
          },
        },
      ],
    };

    // Array-level properties
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Length',
          icon: 'cellNumber',
        },
      },
      {
        key: `${variable.key}.map(item => item.url).join(', ')`,
        name: 'URLs of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellUrl',
          description: 'URLs',
        },
      },
      {
        key: `${variable.key}.map(item => item.signedUrl).join(', ')`,
        name: 'Signed URLs of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellUrl',
          description: 'Signed URLs',
        },
      },
      {
        key: `${variable.key}.map(item => item.title).join(', ')`,
        name: 'Titles of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: 'Titles',
        },
      },
      {
        key: `${variable.key}.map(item => item.mimetype).join(', ')`,
        name: 'MimeTypes of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: 'MimeTypes',
        },
      },
      {
        key: `${variable.key}.map(item => item.size).join(', ')`,
        name: 'Sizes of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellNumber',
          description: 'Sizes',
        },
      },
    ];
  } else if (column.uidt === UITypes.User) {
    variable.extra = {
      ...variable.extra,
      itemSchema: [
        {
          key: 'id',
          name: 'ID',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellSystemKey',
            description: 'User ID',
          },
        },
        {
          key: 'email',
          name: 'Email',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellEmail',
            description: 'User email',
          },
        },
        {
          key: 'display_name',
          name: 'Display Name',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'User display name',
          },
        },
      ],
    };

    variable.children = [
      {
        key: `${variable.key}.map(item => item.id).join(', ')`,
        name: 'User IDs',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellSystemKey',
          description: 'User IDs',
        },
      },
      {
        key: `${variable.key}.map(item => item.email).join(', ')`,
        name: 'Emails',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellEmail',
          description: 'Emails',
        },
      },
      {
        key: `${variable.key}.map(item => item.display_name || '').join(', ')`,
        name: 'Display names',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: 'Display names',
        },
      },
      {
        key: `${variable.key}.length`,
        name: 'Length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Length',
          icon: 'cellNumber',
        },
      },
    ];
  } else if (column.uidt === UITypes.LinkToAnotherRecord && isArray) {
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'Length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Length',
          icon: 'cellNumber',
        },
      },
    ];
  } else if (column.uidt === UITypes.MultiSelect && isArray) {
    variable.extra = {
      ...variable.extra,
      itemSchema: [
        {
          key: '', // Empty key means the item itself (it's a primitive string)
          name: 'option',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'Selected option',
          },
        },
      ],
    };

    // Array-level properties
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'Length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Length',
          icon: 'cellNumber',
        },
      },
    ];
  }

  return variable;
}

/**
 * Generate system/meta variables for records
 */
export function getMetaVariables(prefix: string = ''): VariableDefinition[] {
  const baseKey = prefix ? `${prefix}.` : '';

  return [
    {
      key: `${baseKey}id`,
      name: 'id',
      type: VariableType.String,
      groupKey: VariableGroupKey.Meta,
      extra: {
        description: 'Record ID',
      },
    },
  ];
}

/**
 * Generate complete record variable structure
 * This is the main function for generating variables from NocoDB table columns
 *
 * @param columns - Array of column definitions
 * @param isArray - Whether this represents an array of records
 * @param outputKey - The key under which the record(s) are stored in the output (e.g., 'record', 'deleted', 'records')
 * @param context - Optional context for async column resolution
 */
export async function genRecordVariables(
  columns: Array<ColumnType>,
  isArray: boolean = false,
  outputKey?: string,
  context?: VariableGeneratorContext
): Promise<VariableDefinition[]> {
  const filteredColumns = columns.filter((col) => !isSystemColumn(col));
  const recordKey = outputKey || (isArray ? 'records' : 'record');
  const recordName = recordKey.charAt(0).toUpperCase() + recordKey.slice(1);

  if (isArray) {
    // Generate field variables (without array prefix for itemSchema)
    const fieldVariables = await Promise.all(
      filteredColumns.map((col) => getFieldVariable(col, 'fields', context))
    );

    return [
      {
        key: recordKey,
        name: recordName,
        type: VariableType.Array,
        groupKey: VariableGroupKey.Fields,
        isArray: true,
        extra: {
          description: `List of ${recordName.toLowerCase()}`,
          icon: 'cellJson',
          // Define the structure of each record item
          itemSchema: [
            {
              key: 'id',
              name: 'ID',
              type: VariableType.String,
              groupKey: VariableGroupKey.Fields,
              extra: {
                description: 'Record ID',
                icon: 'cellSystemKey',
              },
            },
            {
              key: 'fields',
              name: 'Fields',
              type: VariableType.Object,
              groupKey: VariableGroupKey.Fields,
              extra: {
                description: 'Record fields',
                icon: 'cellJson',
              },
              children: fieldVariables,
            },
          ],
        },
        children: [
          {
            key: `${recordKey}.length`,
            name: 'Length',
            type: VariableType.Number,
            groupKey: VariableGroupKey.Meta,
            extra: {
              description: 'Length',
              icon: 'cellNumber',
            },
          },
        ],
      },
    ];
  } else {
    // Generate field variables with record prefix
    const fieldVariables = await Promise.all(
      filteredColumns.map(async (col) => {
        const fieldVar = await getFieldVariable(col, 'fields', context);
        return prefixVariableKeys(fieldVar, recordKey);
      })
    );

    return [
      {
        key: recordKey,
        name: recordName,
        type: VariableType.Object,
        groupKey: VariableGroupKey.Fields,
        extra: {
          description: `The ${recordName.toLowerCase()}`,
          icon: 'cellJson',
        },
        children: [
          {
            key: `${recordKey}.id`,
            name: 'ID',
            type: VariableType.String,
            groupKey: VariableGroupKey.Fields,
            extra: {
              description: 'Record ID',
              icon: 'cellSystemKey',
            },
          },
          {
            key: `${recordKey}.fields`,
            name: 'Fields',
            type: VariableType.Object,
            groupKey: VariableGroupKey.Fields,
            extra: {
              description: 'Record fields',
              icon: 'cellJson',
            },
            children: fieldVariables,
          },
        ],
      },
    ];
  }
}

/**
 * Helper to prefix variable keys recursively
 */
export function prefixVariableKeys(
  variable: VariableDefinition,
  prefix: string
): VariableDefinition {
  return {
    ...variable,
    key: `${prefix}.${variable.key}`,
    children: (variable.children ?? []).map((child) =>
      prefixVariableKeys(child, prefix)
    ),
  };
}

/**
 * Generate variables from actual output data (fallback for unknown structures)
 * This is used when we don't have column definitions but have actual output data
 */
export function genGeneralVariables(
  output: any,
  prefix: string = '',
  extra: Partial<VariableDefinition['extra']> = {}
): VariableDefinition[] {
  if (output == null) return [];

  const variables: VariableDefinition[] = [];

  // Primitive value
  if (typeof output !== 'object') {
    return [
      {
        key: prefix || 'value',
        name: prefix || 'value',
        type: typeof output as VariableType,
        groupKey: VariableGroupKey.Fields,
        extra
      },
    ];
  }

  // Array - analyze first item
  if (Array.isArray(output)) {
    if (output.length === 0) return [];

    const firstItem = output[0];
    const arrayName = prefix.split('.').pop() || 'items';

    // If array items are primitives (string, number, boolean)
    if (typeof firstItem !== 'object' || firstItem === null) {
      return [
        {
          key: prefix,
          name: arrayName,
          type: VariableType.Array,
          groupKey: VariableGroupKey.Fields,
          isArray: true,
          extra: {
            ...extra,
            description: `Array of ${typeof firstItem}s`,
            itemSchema: [
              {
                key: '',
                name: 'item',
                type: typeof firstItem as VariableType,
                groupKey: VariableGroupKey.Fields,
                extra: {
                  ...extra,
                  description: `Individual ${typeof firstItem}`,
                },
              },
            ],
          },
          children: [
            {
              key: `${prefix}.length`,
              name: 'Length',
              type: VariableType.Number,
              groupKey: VariableGroupKey.Meta,
              extra: {
                ...extra,
                description: 'Number of items',
              },
            },
          ],
        },
      ];
    }

    // If array items are objects, analyze the structure
    const itemSchema: VariableDefinition[] = [];

    // Analyze first item's properties
    for (const [itemKey, itemValue] of Object.entries(firstItem)) {
      const isNestedArray = Array.isArray(itemValue);
      const valueType = typeof itemValue;

      const itemDef: VariableDefinition = {
        key: itemKey,
        name: itemKey,
        type: isNestedArray
          ? VariableType.Array
          : valueType === 'object' && itemValue !== null
          ? VariableType.Object
          : (valueType as VariableType),
        groupKey: VariableGroupKey.Fields,
        isArray: isNestedArray,
        extra: {
          ...extra,
          description: `${itemKey} property of array item`,
        },
      };

      // For nested objects/arrays, recursively build schema
      if (typeof itemValue === 'object' && itemValue !== null) {
        if (Array.isArray(itemValue) && itemValue.length > 0) {
          // Nested array - recursively generate its itemSchema
          const nestedFirstItem = itemValue[0];
          if (typeof nestedFirstItem === 'object' && nestedFirstItem !== null) {
            const nestedItemSchema: VariableDefinition[] = [];
            for (const [nestedKey, nestedValue] of Object.entries(
              nestedFirstItem
            )) {
              nestedItemSchema.push({
                key: nestedKey,
                name: nestedKey,
                type: typeof nestedValue as VariableType,
                groupKey: VariableGroupKey.Fields,
                extra: {
                  ...extra,
                  description: `${nestedKey} property`,
                },
              });
            }
            itemDef.extra = {
              ...extra,
              ...itemDef.extra,
              itemSchema: nestedItemSchema,
            };
          } else {
            // Array of primitives
            itemDef.extra = {
              ...extra,
              ...itemDef.extra,
              itemSchema: [
                {
                  key: '',
                  name: 'item',
                  type: typeof nestedFirstItem as VariableType,
                  groupKey: VariableGroupKey.Fields,
                  extra
                },
              ],
            };
          }
          itemDef.children = [
            {
              key: `${itemKey}.length`,
              name: 'Length',
              type: VariableType.Number,
              groupKey: VariableGroupKey.Meta,
              extra: {
                ...extra,
                description: 'Number of items',
              },
            },
          ];
        } else if (!Array.isArray(itemValue)) {
          // Nested object - build children
          const nestedChildren: VariableDefinition[] = [];
          for (const [nestedKey, nestedValue] of Object.entries(itemValue)) {
            nestedChildren.push({
              key: `${itemKey}.${nestedKey}`,
              name: nestedKey,
              type: typeof nestedValue as VariableType,
              groupKey: VariableGroupKey.Fields,
              extra: {
                ...extra,
                description: `${nestedKey} property`,
              },
            });
          }
          itemDef.children = nestedChildren;
        }
      }

      itemSchema.push(itemDef);
    }

    return [
      {
        key: prefix,
        name: arrayName,
        type: VariableType.Array,
        groupKey: VariableGroupKey.Fields,
        isArray: true,
        extra: {
          ...extra,
          description: `Array of ${arrayName}`,
          itemSchema: itemSchema,
        },
        children: [
          {
            key: `${prefix}.length`,
            name: 'Length',
            type: VariableType.Number,
            groupKey: VariableGroupKey.Meta,
            extra: {
              ...extra,
              description: 'Number of items',
            },
          },
        ],
      },
    ];
  }

  // Object - recurse into properties
  for (const [key, value] of Object.entries(output)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const isArray = Array.isArray(value);
    const valueType = typeof value;

    const varDef: VariableDefinition = {
      key: fullKey,
      name: key,
      type: isArray
        ? VariableType.Array
        : valueType === 'object'
        ? VariableType.Object
        : (valueType as VariableType),
      groupKey: VariableGroupKey.Fields,
      isArray,
      extra
    };

    // Handle arrays with itemSchema
    if (isArray && value.length > 0) {
      const firstItem = value[0];

      // Array of primitives
      if (typeof firstItem !== 'object' || firstItem === null) {
        varDef.extra = {
          ...extra,
          itemSchema: [
            {
              key: '',
              name: 'item',
              type: typeof firstItem as VariableType,
              groupKey: VariableGroupKey.Fields,
              extra: {
                ...extra,
                description: `Individual ${typeof firstItem}`,
              },
            },
          ],
        };
      } else {
        // Array of objects - build itemSchema
        const itemSchema: VariableDefinition[] = [];
        for (const [itemKey, itemValue] of Object.entries(firstItem)) {
          itemSchema.push({
            key: itemKey,
            name: itemKey,
            type: Array.isArray(itemValue)
              ? VariableType.Array
              : typeof itemValue === 'object' && itemValue !== null
              ? VariableType.Object
              : (typeof itemValue as VariableType),
            groupKey: VariableGroupKey.Fields,
            isArray: Array.isArray(itemValue),
            extra: {
              ...extra,
              description: `${itemKey} property`,
            },
          });
        }
        varDef.extra = { itemSchema };
      }

      // Add length property
      varDef.children = [
        {
          key: `${fullKey}.length`,
          name: 'Length',
          type: VariableType.Number,
          groupKey: VariableGroupKey.Meta,
          extra: {
            ...extra,
            description: 'Number of items',
          },
        },
      ];
    } else if (!isArray && valueType === 'object' && value !== null) {
      // Regular object - recurse into children
      varDef.children = genGeneralVariables(value, fullKey, extra);
    }

    variables.push(varDef);
  }

  return variables;
}
