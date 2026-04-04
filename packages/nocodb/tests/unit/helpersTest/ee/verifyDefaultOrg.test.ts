import 'mocha';
import { expect } from 'chai';
import {
  EnterpriseOrgUserRoles,
  CloudOrgUserRoles,
  RoleLabels,
} from 'nocodb-sdk';
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
      expect(EnterpriseOrgUserRoles.CREATOR).to.equal(
        'cloud-org-level-creator',
      );
    });

    it('VIEWER should map to cloud-org-level-viewer DB value', () => {
      expect(EnterpriseOrgUserRoles.VIEWER).to.equal(
        'cloud-org-level-viewer',
      );
    });

    it('ADMIN and OWNER should have the same DB value', () => {
      expect(EnterpriseOrgUserRoles.ADMIN).to.equal(
        EnterpriseOrgUserRoles.OWNER,
      );
    });

    it('ADMIN and CREATOR should have different DB values', () => {
      expect(EnterpriseOrgUserRoles.ADMIN).to.not.equal(
        EnterpriseOrgUserRoles.CREATOR,
      );
    });

    it('all three active roles should have distinct values (ADMIN vs CREATOR vs VIEWER)', () => {
      const values = new Set([
        EnterpriseOrgUserRoles.ADMIN,
        EnterpriseOrgUserRoles.CREATOR,
        EnterpriseOrgUserRoles.VIEWER,
      ]);
      expect(values.size).to.equal(3);
    });
  });

  describe('CloudOrgUserRoles backward compat', () => {
    it('OWNER equals ADMIN', () => {
      expect(CloudOrgUserRoles.OWNER).to.equal(EnterpriseOrgUserRoles.ADMIN);
    });

    it('CREATOR preserved', () => {
      expect(CloudOrgUserRoles.CREATOR).to.equal(
        EnterpriseOrgUserRoles.CREATOR,
      );
    });

    it('VIEWER preserved', () => {
      expect(CloudOrgUserRoles.VIEWER).to.equal(
        EnterpriseOrgUserRoles.VIEWER,
      );
    });
  });

  describe('RoleLabels for org roles', () => {
    it('cloud-org-level-owner should label as admin (not owner)', () => {
      expect(RoleLabels[CloudOrgUserRoles.OWNER]).to.equal('admin');
    });

    it('cloud-org-level-creator should label as creator', () => {
      expect(RoleLabels[CloudOrgUserRoles.CREATOR]).to.equal('creator');
    });

    it('cloud-org-level-viewer should label as viewer', () => {
      expect(RoleLabels[CloudOrgUserRoles.VIEWER]).to.equal('viewer');
    });
  });
}
