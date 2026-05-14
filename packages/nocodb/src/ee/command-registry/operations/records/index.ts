import {
  RecordInsertContract,
  RecordInsertUndoContract,
  registerInsertHandlers,
} from './insert';
import {
  RecordBulkInsertContract,
  RecordBulkInsertUndoContract,
  registerBulkInsertHandlers,
} from './bulkInsert';
import {
  RecordDeleteContract,
  RecordDeleteUndoContract,
  registerDeleteHandlers,
} from './delete';
import {
  RecordBulkDeleteContract,
  RecordBulkDeleteUndoContract,
  registerBulkDeleteHandlers,
} from './bulkDelete';
import {
  RecordUpdateContract,
  RecordUpdateUndoContract,
  registerUpdateHandlers,
} from './update';
import {
  RecordBulkUpdateContract,
  RecordBulkUpdateUndoContract,
  registerBulkUpdateHandlers,
} from './bulkUpdate';
import {
  RecordBulkUpsertContract,
  RecordBulkUpsertUndoContract,
  registerBulkUpsertHandlers,
} from './bulkUpsert';
import {
  RecordLinkAddContract,
  RecordLinkRemoveContract,
  registerLinkHandlers,
} from './link';
import { RecordMoveContract, registerMoveHandlers } from './move';
import {
  RecordLinkByDisplayContract,
  RecordLinkSwapBulkContract,
  RecordLinkSwapContract,
  registerLinkSwapHandlers,
} from './linkSwap';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import type { DataAliasNestedService } from '~/services/data-alias-nested.service';
import type { DataTableService } from '~/services/data-table.service';

export {
  RecordInsertContract,
  RecordInsertUndoContract,
  RecordBulkInsertContract,
  RecordBulkInsertUndoContract,
  RecordDeleteContract,
  RecordDeleteUndoContract,
  RecordBulkDeleteContract,
  RecordBulkDeleteUndoContract,
  RecordUpdateContract,
  RecordUpdateUndoContract,
  RecordBulkUpdateContract,
  RecordBulkUpdateUndoContract,
  RecordBulkUpsertContract,
  RecordBulkUpsertUndoContract,
  RecordLinkAddContract,
  RecordLinkRemoveContract,
  RecordMoveContract,
  RecordLinkSwapContract,
  RecordLinkSwapBulkContract,
  RecordLinkByDisplayContract,
};

export function registerRecordHandlers(
  dataTableSvc: DataTableService,
  baseTrashSvc: BaseTrashService,
  dataAliasNestedSvc: DataAliasNestedService,
): void {
  registerInsertHandlers(dataTableSvc, baseTrashSvc);
  registerBulkInsertHandlers(dataTableSvc, baseTrashSvc);
  registerDeleteHandlers(dataTableSvc, baseTrashSvc);
  registerBulkDeleteHandlers(dataTableSvc, baseTrashSvc);
  registerUpdateHandlers(dataTableSvc);
  registerBulkUpdateHandlers(dataTableSvc);
  registerBulkUpsertHandlers(dataTableSvc, baseTrashSvc);
  registerLinkHandlers(dataTableSvc, dataAliasNestedSvc);
  registerMoveHandlers(dataTableSvc);
  registerLinkSwapHandlers(dataTableSvc);
}
