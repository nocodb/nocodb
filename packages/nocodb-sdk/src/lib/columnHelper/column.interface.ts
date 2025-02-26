import { ColumnType, TableType, UserType } from '../Api';

export default abstract class AbstractColumnHelper {
  public columnDefaultMeta?: Record<string, any> = {};
  public abstract serializeValue(value: unknown, column: ColumnType): any;
  public abstract parseValue(value: unknown, column: ColumnType): any;
  public abstract parsePlainCellValue(
    value: unknown,
    column: ColumnType
  ): string;
}

export interface SerializerOrParserFnProps {
  value: any;
  params: {
    col: ColumnType;
    abstractType: unknown;
    meta: TableType;
    metas: { [idOrTitle: string]: TableType | any };
    baseUsers?: Map<string, UserType[]>;
    isMysql: (sourceId?: string) => boolean;
    isMssql: (sourceId?: string) => boolean;
    isXcdbBase: (sourceId?: string) => boolean;
    isUnderLookup?: boolean;
  };
}
