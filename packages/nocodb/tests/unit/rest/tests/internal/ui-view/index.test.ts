import { viewBasicTests } from './view-basic.test';
import { viewCreateTypesTests } from './view-create-types.test';
import { viewColumnsTests } from './view-columns.test';
import { viewFiltersTests } from './view-filters.test';
import { viewSortsTests } from './view-sorts.test';
import { viewRowColorsTests } from './view-row-colors.test';
import { viewSharingTests } from './view-sharing.test';
import { viewTypeUpdatesTests } from './view-type-updates.test';

export const internalUiViewTests = function () {
  describe('View Operations', () => {
    viewBasicTests();
    viewCreateTypesTests();
    viewColumnsTests();
    viewFiltersTests();
    viewSortsTests();
    viewRowColorsTests();
    viewSharingTests();
    viewTypeUpdatesTests();
  });
};
