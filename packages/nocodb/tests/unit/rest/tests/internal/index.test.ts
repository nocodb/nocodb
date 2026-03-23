import { internalUiViewTests } from './ui-view/index.test';
import { internalDocumentTests } from './documents/index.test';

let dateDependencyTests = () => {};
if (process.env.EE === 'true') {
  dateDependencyTests =
    require('./ee/date-dependency.test').dateDependencyTests;
}

export const internalTests = function () {
  describe('Internal API', () => {
    internalUiViewTests();
    internalDocumentTests();
    dateDependencyTests();
  });
};
