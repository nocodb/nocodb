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
    it('ADMIN should map to cloud-org-level-owner DB value', () => {
      expect(EnterpriseOrgUserRoles.ADMIN).to.equal('cloud-org-level-owner');
    });

    it('CREATOR should map to cloud-org-level-creator DB value', () => {
      expect(EnterpriseOrgUserRoles.CREATOR).to.equal('cloud-org-level-creator');
    });

    it('VIEWER should map to cloud-org-level-viewer DB value', () => {
      expect(EnterpriseOrgUserRoles.VIEWER).to.equal('cloud-org-level-viewer');
    });

    it('CloudOrgUserRoles backward compat — OWNER equals ADMIN', () => {
      expect(CloudOrgUserRoles.OWNER).to.equal(EnterpriseOrgUserRoles.ADMIN);
    });

    it('CloudOrgUserRoles backward compat — CREATOR preserved', () => {
      expect(CloudOrgUserRoles.CREATOR).to.equal(EnterpriseOrgUserRoles.CREATOR);
    });
  });
}
