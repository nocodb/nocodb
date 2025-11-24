import UITypes from '../UITypes';
import { isSystemColumn, parseProp } from '../helperFunctions';
import {
  VariableDefinition,
  VariableGroupKey,
  VariableType,
} from './interface';
import { RelationTypes } from '../globals';
import { ColumnType } from '~/lib';

/**
 * Map UIType to icon name (matching NocoDB's iconMap)
 */
export function uiTypeToIcon(uiType: UITypes): string {
  switch (uiType) {
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
    case UITypes.Links:
      return 'hm_solid'; // Default to has-many, will be refined based on relation type
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
      columnId: column.id,
      uiType: column.uidt,
      icon: uiTypeToIcon(column.uidt as UITypes),
    },
  };

  if (column.uidt === UITypes.Attachment && isArray) {
    variable.children = [
      {
        key: `${variable.key}[i].url`,
        name: 'url',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellUrl' },
      },
      {
        key: `${variable.key}[i].signedUrl`,
        name: 'signedUrl',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellUrl' },
      },
      {
        key: `${variable.key}[i].title`,
        name: 'title',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellText' },
      },
      {
        key: `${variable.key}[i].mimetype`,
        name: 'mimetype',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellText' },
      },
      {
        key: `${variable.key}[i].size`,
        name: 'size',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellNumber' },
      },
      // Add .length for arrays
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
    ];
  } else if (column.uidt === UITypes.Collaborator) {
    const isMulti = parseProp(column.meta)?.is_multi;
    const userProps: VariableDefinition[] = [
      {
        key: `${variable.key}${isMulti ? '[i]' : ''}.id`,
        name: 'id',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellSystemKey' },
      },
      {
        key: `${variable.key}${isMulti ? '[i]' : ''}.email`,
        name: 'email',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellEmail' },
      },
      {
        key: `${variable.key}${isMulti ? '[i]' : ''}.display_name`,
        name: 'display_name',
        type: VariableType.String,
        groupKey: VariableGroupKey.Fields,
        extra: { icon: 'cellText' },
      },
    ];

    if (isMulti) {
      userProps.push({
        key: `${variable.key}.length`,
        name: 'length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Number of users',
          icon: 'cellNumber',
        },
      });
    }

    variable.children = userProps;
  } else if (column.uidt === UITypes.LinkToAnotherRecord && isArray) {
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'length',
        type: VariableType.Number,
        groupKey: VariableGroupKey.Meta,
        extra: {
          description: 'Number of linked records',
          icon: 'cellNumber',
        },
      },
    ];
  } else if (column.uidt === UITypes.MultiSelect) {
    variable.children = [
      {
        key: `${variable.key}.length`,
        name: 'length',
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
 * Append .length property to array variables recursively
 */
function appendArrayLengthVariable(
  variables: VariableDefinition[]
): VariableDefinition[] {
  return variables.map((variable) => {
    if (variable.isArray && !variable.children) {
      // Add length property if not already present
      return {
        ...variable,
        children: [
          {
            key: `${variable.key}.length`,
            name: 'length',
            type: VariableType.Number,
            groupKey: VariableGroupKey.Meta,
            extra: {
              description: `Number of ${variable.name.toLowerCase()}`,
            },
          },
        ],
      };
    } else if (variable.children) {
      // Recursively process children
      return {
        ...variable,
        children: appendArrayLengthVariable(variable.children),
      };
    }
    return variable;
  });
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
    // Generate field variables with array item prefix
    const fieldVariables = filteredColumns.map((col) => {
      const fieldVar = getFieldVariable(col, 'fields');
      return prefixVariableKeys(fieldVar, `${recordKey}[i]`);
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
        },
        children: [
          {
            key: `${recordKey}[i].id`,
            name: 'ID',
            type: VariableType.String,
            groupKey: VariableGroupKey.Fields,
            extra: {
              description: 'Record ID',
              icon: 'cellSystemKey',
            },
          },
          {
            key: `${recordKey}[i].fields`,
            name: 'Fields',
            type: VariableType.Object,
            groupKey: VariableGroupKey.Fields,
            extra: {
              description: 'Record fields',
              icon: 'cellJson',
            },
            children: fieldVariables,
          },
          {
            key: `${recordKey}.length`,
            name: 'Count',
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
    children: variable.children?.map((child) =>
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

    const itemVars = genGeneralVariables(output[0], `${prefix}[i]`);

    return [
      {
        key: prefix,
        name: prefix.split('.').pop() || 'items',
        type: VariableType.Array,
        groupKey: VariableGroupKey.Fields,
        isArray: true,
        children: [
          ...itemVars,
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

    variables.push({
      key: fullKey,
      name: key,
      type: isArray
        ? VariableType.Array
        : valueType === 'object'
        ? VariableType.Object
        : (valueType as VariableType),
      groupKey: VariableGroupKey.Fields,
      isArray,
      children:
        typeof value === 'object' && value !== null
          ? genGeneralVariables(value, fullKey)
          : undefined,
    });
  }

  return appendArrayLengthVariable(variables);
}
