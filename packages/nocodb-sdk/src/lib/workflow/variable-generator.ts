import UITypes from '../UITypes';
import { isSystemColumn, parseProp } from '../helperFunctions';
import {
  VariableDefinition,
  VariableGroupKey,
  VariableType,
} from './interface';
import { RelationTypes } from '../globals';
import { ColumnType } from '~/lib';
import { LinkToAnotherRecordType } from '~/lib/Api';

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
 * Convert NocoDB UIType to VariableType
 */
export function uiTypeToVariableType(
  uiType: UITypes,
  columnMeta?: any
): { type: VariableType; isArray: boolean } {
  switch (uiType) {
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

    case UITypes.Collaborator: {
      // Check if multi-user
      const isMultiUser = parseProp(columnMeta?.meta)?.is_multi;
      return { type: VariableType.Object, isArray: isMultiUser };
    }

    case UITypes.LastModifiedBy:
    case UITypes.CreatedBy:
      return { type: VariableType.Object, isArray: false };

    case UITypes.JSON:
      return { type: VariableType.Object, isArray: false };

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
export function getFieldVariable(
  column: ColumnType,
  prefix: string = 'fields'
): VariableDefinition {
  const { type, isArray } = uiTypeToVariableType(
    column.uidt as UITypes,
    column.colOptions
  );

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
            description: 'URL of the attachment',
          },
        },
        {
          key: 'signedUrl',
          name: 'Signed URL',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellUrl',
            description: 'Signed URL of the attachment',
          },
        },
        {
          key: 'title',
          name: 'Title',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'Title of the attachment',
          },
        },
        {
          key: 'mimetype',
          name: 'MimeType',
          type: VariableType.String,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellText',
            description: 'MIME type of the attachment',
          },
        },
        {
          key: 'size',
          name: 'Size',
          type: VariableType.Number,
          groupKey: VariableGroupKey.Fields,
          extra: {
            icon: 'cellNumber',
            description: 'Size of the attachment in bytes',
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
          description: 'Number of attachments',
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
          description: 'Comma-separated URLs of all attachments',
        },
      },
      {
        key: `${variable.key}.map(item => item.signedUrl).join(', ')`,
        name: 'Signed URLs of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellUrl',
          description: 'Comma-separated signed URLs of all attachments',
        },
      },
      {
        key: `${variable.key}.map(item => item.title).join(', ')`,
        name: 'Titles of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: 'Comma-separated titles of all attachments',
        },
      },
      {
        key: `${variable.key}.map(item => item.mimetype).join(', ')`,
        name: 'MimeTypes of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: 'Comma-separated mimetypes of all attachments',
        },
      },
      {
        key: `${variable.key}.map(item => item.size).join(', ')`,
        name: 'Sizes of all attachments',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellNumber',
          description: 'Comma-separated sizes of all attachments',
        },
      },
    ];
  } else if (column.uidt === UITypes.Collaborator) {
    const isMulti = parseProp(column.meta)?.is_multi;

    variable.extra = isMulti
      ? {
          ...variable.extra,
          itemSchema: [
            {
              key: 'id',
              name: 'id',
              type: VariableType.String,
              groupKey: VariableGroupKey.Fields,
              extra: {
                icon: 'cellSystemKey',
                description: 'User ID',
              },
            },
            {
              key: 'email',
              name: 'email',
              type: VariableType.String,
              groupKey: VariableGroupKey.Fields,
              extra: {
                icon: 'cellEmail',
                description: 'User email',
              },
            },
            {
              key: 'display_name',
              name: 'display_name',
              type: VariableType.String,
              groupKey: VariableGroupKey.Fields,
              extra: {
                icon: 'cellText',
                description: 'User display name',
              },
            },
          ],
        }
      : {};

    // Array-level properties
    variable.children = [
      {
        key: isMulti
          ? `${variable.key}.map(item => item.id).join(', ')`
          : `${variable.key}.id`,
        name: 'User IDs of all collaborators',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellSystemKey',
          description: isMulti ? 'Comma-separated user IDs' : 'User ID',
        },
      },
      {
        key: isMulti
          ? `${variable.key}.map(item => item.email).join(', ')`
          : `${variable.key}.email`,
        name: 'Emails of all collaborators',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellEmail',
          description: isMulti ? 'Comma-separated emails' : 'User email',
        },
      },
      {
        key: isMulti
          ? `${variable.key}.map(item => item.display_name || '').join(', ')`
          : `${variable.key}.display_name`,
        name: 'Display names of all collaborators',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: {
          icon: 'cellText',
          description: isMulti
            ? 'Comma-separated display names'
            : 'User display name',
        },
      },
      {
        key: `${variable.key}.length`,
        name: 'Number of collaborators',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Number of collaborators',
          icon: 'cellNumber',
        },
      },
    ];
  } else if (column.uidt === UITypes.LinkToAnotherRecord && isArray) {
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'Number of linked records',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Number of linked records',
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
        name: 'Number of selected options',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Number of selected options',
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
 */
export function genRecordVariables(
  columns: Array<ColumnType>,
  isArray: boolean = false,
  outputKey?: string
): VariableDefinition[] {
  const filteredColumns = columns.filter((col) => !isSystemColumn(col));
  const recordKey = outputKey || (isArray ? 'records' : 'record');
  const recordName = recordKey.charAt(0).toUpperCase() + recordKey.slice(1);

  if (isArray) {
    // Generate field variables (without array prefix for itemSchema)
    const fieldVariables = filteredColumns.map((col) => {
      return getFieldVariable(col, 'fields');
    });

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
            name: 'Number of records',
            type: VariableType.Number,
            groupKey: VariableGroupKey.Meta,
            extra: {
              description: 'Number of records',
              icon: 'cellNumber',
            },
          },
        ],
      },
    ];
  } else {
    // Generate field variables with record prefix
    const fieldVariables = filteredColumns.map((col) => {
      const fieldVar = getFieldVariable(col, 'fields');
      return prefixVariableKeys(fieldVar, recordKey);
    });

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
  prefix: string = ''
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
            description: `Array of ${typeof firstItem}s`,
            itemSchema: [
              {
                key: '',
                name: 'item',
                type: typeof firstItem as VariableType,
                groupKey: VariableGroupKey.Fields,
                extra: {
                  description: `Individual ${typeof firstItem}`,
                },
              },
            ],
          },
          children: [
            {
              key: `${prefix}.length`,
              name: 'length',
              type: VariableType.Number,
              groupKey: VariableGroupKey.Meta,
              extra: {
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
                  description: `${nestedKey} property`,
                },
              });
            }
            itemDef.extra = {
              ...itemDef.extra,
              itemSchema: nestedItemSchema,
            };
          } else {
            // Array of primitives
            itemDef.extra = {
              ...itemDef.extra,
              itemSchema: [
                {
                  key: '',
                  name: 'item',
                  type: typeof nestedFirstItem as VariableType,
                  groupKey: VariableGroupKey.Fields,
                },
              ],
            };
          }
          itemDef.children = [
            {
              key: `${itemKey}.length`,
              name: 'length',
              type: VariableType.Number,
              groupKey: VariableGroupKey.Meta,
              extra: {
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
          description: `Array of ${arrayName}`,
          itemSchema: itemSchema,
        },
        children: [
          {
            key: `${prefix}.length`,
            name: 'length',
            type: VariableType.Number,
            groupKey: VariableGroupKey.Meta,
            extra: {
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
    };

    // Handle arrays with itemSchema
    if (isArray && value.length > 0) {
      const firstItem = value[0];

      // Array of primitives
      if (typeof firstItem !== 'object' || firstItem === null) {
        varDef.extra = {
          itemSchema: [
            {
              key: '',
              name: 'item',
              type: typeof firstItem as VariableType,
              groupKey: VariableGroupKey.Fields,
              extra: {
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
          name: 'length',
          type: VariableType.Number,
          groupKey: VariableGroupKey.Meta,
          extra: {
            description: 'Number of items',
          },
        },
      ];
    } else if (!isArray && valueType === 'object' && value !== null) {
      // Regular object - recurse into children
      varDef.children = genGeneralVariables(value, fullKey);
    }

    variables.push(varDef);
  }

  return variables;
}
