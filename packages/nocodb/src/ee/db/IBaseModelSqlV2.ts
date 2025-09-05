import type { IBaseModelSqlV2 as IBaseModelSqlV2CE } from 'src/db/IBaseModelSqlV2';

export interface IBaseModelSqlV2 extends IBaseModelSqlV2CE {
  statsUpdate(args: { count: number }): Promise<void>;
}
