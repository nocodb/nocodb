import { tableColumnMutationTests } from './table-column-mutations.test';
import { viewMutationTests } from './view-mutations.test';
import { viewRowColoringTests } from './view-row-coloring.test';
import { filterSortMutationTests } from './filter-sort-mutations.test';
import { hookMutationTests } from './hook-mutations.test';

export const internalUiPostTests = function () {
  describe.only('UiPost Operations', () => {
    tableColumnMutationTests();
    viewMutationTests();
    viewRowColoringTests();
    filterSortMutationTests();
    hookMutationTests();
  });
};
