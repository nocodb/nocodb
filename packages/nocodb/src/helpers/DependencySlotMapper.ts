import { DependencyTableType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

export enum DependencySlotTypes {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  TIMESTAMP = 'timestamp',
}

enum DependencyFields {
  // Queryable fields (indexed)
  QUERYABLE_FIELD_0 = 'queryable_field_0',
  QUERYABLE_FIELD_1 = 'queryable_field_1',
  QUERYABLE_FIELD_2 = 'queryable_field_2', // timestamptz for cron triggers

  // Meta field (JSON, not indexed)
  META = 'meta',
}

interface FieldDefinition {
  id: DependencyFields;
  type: DependencySlotTypes;
  required?: boolean;
}

type FieldMappings = Record<
  DependencyTableType,
  Record<string, FieldDefinition>
>;

/**
 * Manages the mapping between logical fields and physical database fields
 * for dependency tracking. Uses 2 queryable fields + 1 meta JSON field.
 *
 * Architecture:
 * - Queryable fields: Indexed columns for WHERE clause filtering
 * - Meta field: JSON object for display/reference data
 */
export class DependencySlotMapper {
  private readonly mappings: FieldMappings;

  constructor() {
    this.mappings = {
      [DependencyTableType.Widget]: {
        path: {
          id: DependencyFields.META,
          type: DependencySlotTypes.STRING,
          required: false,
        },
      },
      [DependencyTableType.Workflow]: {
        nodeType: {
          id: DependencyFields.QUERYABLE_FIELD_0, // Indexed - node type (e.g., "core.trigger.cron")
          type: DependencySlotTypes.STRING,
          required: false,
        },
        triggerId: {
          id: DependencyFields.QUERYABLE_FIELD_1, // Indexed - for webhook routing (e.g., "trg_abc123")
          type: DependencySlotTypes.STRING,
          required: false,
        },
        nextSyncAt: {
          id: DependencyFields.QUERYABLE_FIELD_2, // Indexed - for cron trigger scheduling
          type: DependencySlotTypes.TIMESTAMP,
          required: false,
        },
        path: {
          id: DependencyFields.META,
          type: DependencySlotTypes.STRING,
          required: false,
        },
        nodeId: {
          id: DependencyFields.META,
          type: DependencySlotTypes.STRING,
          required: false,
        },
        // External trigger state (returned from onActivateHook, needed for cleanup)
        activationState: {
          id: DependencyFields.META,
          type: DependencySlotTypes.OBJECT,
          required: false,
        },
      },
      [DependencyTableType.Column]: {},
      [DependencyTableType.Model]: {},
      [DependencyTableType.View]: {},
    };
  }

  /**
   * Check if a field ID represents a queryable (indexed) field
   */
  private isQueryableField(fieldId: string): boolean {
    return (
      fieldId === DependencyFields.QUERYABLE_FIELD_0 ||
      fieldId === DependencyFields.QUERYABLE_FIELD_1 ||
      fieldId === DependencyFields.QUERYABLE_FIELD_2
    );
  }

  /**
   * Get field mapping for a specific dependent type
   */
  public getMapping(
    dependentType: DependencyTableType,
  ): Record<string, FieldDefinition> {
    return this.mappings[dependentType] || {};
  }

  /**
   * Extract physical database fields from logical dependency info
   * Separates queryable fields from meta fields
   */
  public extractSlotFields(
    dependentType: DependencyTableType,
    item: Record<string, any>,
  ): Record<string, any> {
    const mapping = this.getMapping(dependentType);
    const fields: Record<string, any> = {};
    const metaFields: Record<string, any> = {};

    for (const [logicalField, fieldDef] of Object.entries(mapping)) {
      let value = item[logicalField];

      // Check required fields
      if (fieldDef.required && value === undefined) {
        NcError.badRequest(`Missing required field: ${logicalField}`);
      }

      // Skip undefined optional fields
      if (value === undefined) {
        continue;
      }

      // Validate and coerce types
      value = this.validateAndCoerceValue(value, fieldDef.type, logicalField);

      // Separate queryable fields from meta fields
      if (this.isQueryableField(fieldDef.id)) {
        // Store directly in database column
        fields[fieldDef.id] = value;
      } else {
        // Store in meta JSON
        metaFields[logicalField] = value;
      }
    }

    // If there are meta fields, stringify and store in meta column
    if (Object.keys(metaFields).length > 0) {
      fields[DependencyFields.META] = JSON.stringify(metaFields);
    }

    return fields;
  }

  /**
   * Hydrate logical fields from physical database data
   * Parses meta JSON and combines with queryable fields
   */
  public hydrateSlotFields(
    dependentType: DependencyTableType,
    record: Record<string, any>,
  ): Record<string, any> {
    const mapping = this.getMapping(dependentType);
    const fields: Record<string, any> = {};

    // First, extract queryable fields
    for (const [logicalField, fieldDef] of Object.entries(mapping)) {
      if (
        this.isQueryableField(fieldDef.id) &&
        record[fieldDef.id] !== undefined
      ) {
        fields[logicalField] = record[fieldDef.id];
      }
    }

    // Then, parse meta JSON and extract non-queryable fields
    if (record[DependencyFields.META]) {
      try {
        const metaData =
          typeof record[DependencyFields.META] === 'string'
            ? JSON.parse(record[DependencyFields.META])
            : record[DependencyFields.META];

        // Only include fields that are defined in the mapping
        for (const [logicalField, fieldDef] of Object.entries(mapping)) {
          if (
            !this.isQueryableField(fieldDef.id) &&
            metaData[logicalField] !== undefined &&
            metaData[logicalField] !== null
          ) {
            fields[logicalField] = metaData[logicalField];
          }
        }
      } catch (e) {
        // If JSON parsing fails, log error but don't break
        console.error('Failed to parse dependency meta field:', e);
      }
    }

    return fields;
  }

  /**
   * Get the physical field ID for a logical field
   * Used for building query conditions
   * Only returns IDs for queryable fields
   */
  public getSlotId(
    dependentType: DependencyTableType,
    logicalField: string,
  ): string | null {
    const mapping = this.getMapping(dependentType);
    const fieldDef = mapping[logicalField];

    // Only return field ID for queryable fields
    // Meta fields cannot be queried directly
    if (fieldDef && this.isQueryableField(fieldDef.id)) {
      return fieldDef.id;
    }

    return null;
  }

  /**
   * Validate and coerce value to the expected type
   */
  private validateAndCoerceValue(
    value: any,
    type: DependencySlotTypes,
    fieldName: string,
  ): any {
    switch (type) {
      case DependencySlotTypes.NUMBER:
        if (isNaN(Number(value))) {
          NcError.badRequest(`Invalid type for field: ${fieldName}`);
        }
        return Number(value);

      case DependencySlotTypes.BOOLEAN:
        return !!value;

      case DependencySlotTypes.ARRAY:
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            NcError.badRequest(`Invalid type for field: ${fieldName}`);
          }
        }
        if (!Array.isArray(value)) {
          NcError.badRequest(`Invalid type for field: ${fieldName}`);
        }
        // Keep as array for meta JSON (will be stringified with entire meta object)
        return value;

      case DependencySlotTypes.OBJECT:
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            NcError.badRequest(`Invalid type for field: ${fieldName}`);
          }
        }
        if (typeof value !== 'object' || value === null) {
          NcError.badRequest(`Invalid type for field: ${fieldName}`);
        }
        // Keep as object for meta JSON (will be stringified with entire meta object)
        return value;

      case DependencySlotTypes.STRING:
        if (typeof value !== 'string') {
          NcError.badRequest(`Invalid type for field: ${fieldName}`);
        }
        return value;

      case DependencySlotTypes.TIMESTAMP:
        // Accept Date objects or ISO strings
        if (value instanceof Date) {
          return value;
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            NcError.badRequest(`Invalid timestamp for field: ${fieldName}`);
          }
          return date;
        }
        NcError.badRequest(`Invalid type for field: ${fieldName}`);
        return value;

      default:
        return value;
    }
  }
}

export const dependencySlotMapper = new DependencySlotMapper();
