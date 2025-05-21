import { ColumnType, TableType, UserType } from '../Api';

export default abstract class AbstractColumnHelper {
  public columnDefaultMeta?: Record<string, any> = {};

  /**
   * Serializes the given value based on column parameters.
   *
   * **WARNING:** This method **can throw errors**. Use a `try-catch` block when calling it.
   *
   * @param value - The value to be serialized.
   * @param params - Additional parameters related to column serialization.
   * @returns The serialized value.
   * @throws {Error} If serialization fails.
   */
  public abstract serializeValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): any;

  /**
   * Parses a stored value back into its original form.
   * Converts a database-stored value into a display-friendly format.
   *
   * @example
   * // Example: Formatting percentage values
   * dbValue = 59; // Stored in DB
   * displayValue = "59%"; // Displayed to users
   *
   * @param value - The value to be parsed from storage format.
   * @param params - Additional parameters related to column parsing.
   * @returns The parsed value in a display-friendly format.
   */
  public abstract parseValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): any;

  /**
   * Converts a plain cell value into a string representation.
   *
   * **Note:** This method is incomplete and may require further implementation.
   *
   * @param value - The value to be parsed into a string.
   * @param params - Additional parameters related to column parsing.
   * @returns The parsed value as a string.
   */
  public abstract parsePlainCellValue(
    value: SerializerOrParserFnProps['value'],
    params: SerializerOrParserFnProps['params']
  ): string;
}

export interface SerializerOrParserFnProps {
  value: any;
  params: {
    col: ColumnType;
    abstractType?: unknown;
    meta?: TableType;
    metas?: { [idOrTitle: string]: TableType };
    baseUsers?: Map<string, UserType[]>;
    isMysql?: (sourceId: string) => boolean;
    isMssql?: (sourceId: string) => boolean;
    isXcdbBase?: (sourceId: string) => boolean;
    isPg?: (sourceId: string) => boolean;
    isUnderLookup?: boolean;
    rowId?: string | null;
    isMultipleCellPaste?: boolean;
  };
}
