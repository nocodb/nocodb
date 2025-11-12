import type { Column, LinkToAnotherRecordColumn, Model } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export interface LinkUnlinkRequest {
  modelId: string;
  model?: Model;
  baseModel?: IBaseModelSqlV2;
  columnId: string;
  column?: Column;
  colOptions?: LinkToAnotherRecordColumn;
  links?: {
    rowId: string;
    linkIds: Set<string>;
  }[];
  unlinks?: {
    rowId: string;
    linkIds: Set<string>;
  }[];
}
export type LinkUnlinkProcessRequest = LinkUnlinkRequest & {
  model: Model;
  baseModel: IBaseModelSqlV2;
  column: Column;
  colOptions: LinkToAnotherRecordColumn;
  links?: {
    rowId: string;
    linkIds: Set<string>;
  }[];
  unlinks?: {
    rowId: string;
    linkIds: Set<string>;
  }[];
};
