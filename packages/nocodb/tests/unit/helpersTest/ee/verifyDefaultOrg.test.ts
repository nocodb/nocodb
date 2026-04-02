import 'mocha';
import { expect } from 'chai';
import { CloudOrgUserRoles } from 'nocodb-sdk';
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

  describe('CloudOrgUserRoles enum', () => {
    it('should have OWNER role', () => {
      expect(CloudOrgUserRoles.OWNER).to.equal('cloud-org-level-owner');
    });

    it('should have ADMIN role', () => {
      expect(CloudOrgUserRoles.ADMIN).to.equal('cloud-org-level-admin');
    });

    it('should have CREATOR role', () => {
      expect(CloudOrgUserRoles.CREATOR).to.equal('cloud-org-level-creator');
    });

    it('should have VIEWER role', () => {
      expect(CloudOrgUserRoles.VIEWER).to.equal('cloud-org-level-viewer');
    });

    it('should have exactly 4 roles', () => {
      const roleValues = Object.values(CloudOrgUserRoles);
      expect(roleValues).to.have.length(4);
    });

    it('OWNER and ADMIN should be distinct values', () => {
      expect(CloudOrgUserRoles.OWNER).to.not.equal(CloudOrgUserRoles.ADMIN);
    });
  });
}
