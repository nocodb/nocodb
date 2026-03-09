import { documentAclTests } from './document-acl.test';
import { documentPermissionsTests } from './document-permissions.test';

export const internalDocumentTests = function () {
  describe('Document Operations', () => {
    documentAclTests();
    documentPermissionsTests();
  });
};
