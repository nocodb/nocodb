import { testExtractFilterFromXwhere } from './filterHelpers_old.spec';
import { extractFilterFromXwhere } from './filterHelpers_withparser';

testExtractFilterFromXwhere(
  'filterHelpers_withparser',
  extractFilterFromXwhere
);
