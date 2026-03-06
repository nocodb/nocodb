import { tableSchemaGetTests } from './table-schema.test';
import { filtersSortsHooksGetTests } from './filters-sorts-hooks.test';
import { dataOperationsGetTests } from './data-operations.test';
import { syncSourceGetTests } from './sync-source.test';
import { extensionsGetTests } from './extensions.test';

export const internalUiGetTests = function () {
  describe('UiGet Operations', () => {
    tableSchemaGetTests();
    filtersSortsHooksGetTests();
    dataOperationsGetTests();
    syncSourceGetTests();
    extensionsGetTests();
  });
};
