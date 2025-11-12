import type { Logger } from '@nestjs/common';
import type { Column, LinkToAnotherRecordColumn, Model } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export interface LinkRow {
  rowId: string;
  linkIds: Set<string>;
}

export interface LinkUnlinkRequest {
  modelId: string;
  logger?: Logger;
  cookie?: any;
  model?: Model;
  baseModel?: IBaseModelSqlV2;
  columnId: string;
  column?: Column;
  colOptions?: LinkToAnotherRecordColumn;
  links?: LinkRow[];
  unlinks?: LinkRow[];
}
export type LinkUnlinkProcessRequest = LinkUnlinkRequest & {
  model: Model;
  baseModel: IBaseModelSqlV2;
  column: Column;
  colOptions: LinkToAnotherRecordColumn;
  links?: LinkRow[];
  unlinks?: LinkRow[];
};
