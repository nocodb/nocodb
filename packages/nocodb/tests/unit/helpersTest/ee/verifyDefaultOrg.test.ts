import 'mocha';
import { expect } from 'chai';
import { EnterpriseOrgUserRoles, CloudOrgUserRoles } from 'nocodb-sdk';
import {
  NC_DEFAULT_ORG_ID,
  NC_STORE_DEFAULT_ORG_ID_KEY,
} from '../../../../src/utils/globals';

export function verifyDefaultOrgTests() {
  describe('verifyDefaultOrg — constants', () => {
    it('NC_DEFAULT_ORG_ID should be "nc"', () => {
      expect(NC_DEFAULT_ORG_ID).to.equal('nc');
    });

    it('NC_STORE_DEFAULT_ORG_ID_KEY should be "NC_DEFAULT_ORG_ID"', () => {
      expect(NC_STORE_DEFAULT_ORG_ID_KEY).to.equal('NC_DEFAULT_ORG_ID');
    });
  });

  describe('EnterpriseOrgUserRoles enum', () => {
    it('should have ADMIN role', () => {
      expect(EnterpriseOrgUserRoles.ADMIN).to.equal('cloud-org-level-admin');
    });

    it('should have CREATOR role', () => {
      expect(EnterpriseOrgUserRoles.CREATOR).to.equal('cloud-org-level-creator');
    });

    it('should have VIEWER role', () => {
      expect(EnterpriseOrgUserRoles.VIEWER).to.equal('cloud-org-level-viewer');
    });

    it('CloudOrgUserRoles should be an alias for EnterpriseOrgUserRoles', () => {
      expect(CloudOrgUserRoles.ADMIN).to.equal(EnterpriseOrgUserRoles.ADMIN);
      expect(CloudOrgUserRoles.CREATOR).to.equal(EnterpriseOrgUserRoles.CREATOR);
      expect(CloudOrgUserRoles.VIEWER).to.equal(EnterpriseOrgUserRoles.VIEWER);
    });
  });
}
