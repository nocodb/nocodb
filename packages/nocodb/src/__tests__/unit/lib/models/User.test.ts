import { expect } from 'chai';
import User from '../../../../lib/models/User';
const sinon = require('sinon').createSandbox();

describe('User', () => {
  describe('isSuperAdmin', () => {
    describe('when user is super admin', () => {
      before(() => {
        sinon.replace(User, 'get', sinon.fake.returns({ roles: 'user,super' }));
      });

      after(() => {
        sinon.restore();
      });

      it('returns true', async () => {
        const isSuperAdmin = await User.isSuperAdmin('super3');
        expect(isSuperAdmin).eql(true);
      });
    });

    describe('when user is not super admin', () => {
      before(() => {
        sinon.replace(User, 'get', sinon.fake.returns({ roles: 'user' }));
      });

      after(() => {
        sinon.restore();
      });

      it('returns false', async () => {
        const isSuperAdmin = await User.isSuperAdmin('super4');
        expect(isSuperAdmin).eql(false);
      });
    });
  });
});
