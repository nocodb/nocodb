import { tableColumnMutationTests } from './table-column-mutations.test';
import { viewMutationTests } from './view-mutations.test';
import { viewRowColoringTests } from './view-row-coloring.test';
import { filterSortMutationTests } from './filter-sort-mutations.test';
import { hookMutationTests } from './hook-mutations.test';
import { dataMutationTests } from './data-mutations.test';
import { commentMutationTests } from './comment-mutations.test';
import { deleteNestedMutationTests } from './delete-nested-mutations.test';
import { syncExtensionMutationTests } from './sync-extension-mutations.test';
import { eeFilterListviewMutationTests } from './ee-filter-listview-mutations.test';

export const internalUiPostTests = function () {
  describe('UiPost Operations', () => {
    tableColumnMutationTests();
    viewMutationTests();
    viewRowColoringTests();
    filterSortMutationTests();
    hookMutationTests();
    dataMutationTests();
    commentMutationTests();
    deleteNestedMutationTests();
    syncExtensionMutationTests();
    eeFilterListviewMutationTests();
  });
};
