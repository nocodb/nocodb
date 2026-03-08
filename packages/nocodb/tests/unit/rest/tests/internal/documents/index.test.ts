import { documentAclTests } from './document-acl.test';

export const internalDocumentTests = function () {
  describe('Document Operations', () => {
    documentAclTests();
  });
};
