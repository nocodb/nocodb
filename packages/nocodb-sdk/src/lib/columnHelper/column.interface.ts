import { ColumnType } from '../Api';

export default abstract class AbstractColumnHelper {
  public static columnDefaultMeta?: Record<string, any> = {};
  public abstract serializeValue(value: unknown, column: ColumnType): any;
  public abstract parseValue(value: unknown, column: ColumnType): any;
  public abstract parsePlainCellValue(
    value: unknown,
    column: ColumnType
  ): string;
}
