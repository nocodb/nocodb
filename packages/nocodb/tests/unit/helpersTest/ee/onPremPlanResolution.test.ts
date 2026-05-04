import 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  OnPremPlanTitles,
  PlanFeatureTypes,
  PlanLimitTypes,
} from 'nocodb-sdk';

// `getOnPremPlan` lives in src/ee-on-prem/. Inside that module, `~/NocoLicense`
// resolves through the running tsconfig — under tests/unit/tsconfig.ee.json
// that's the EE stub at src/ee/NocoLicense.ts (ee-on-prem is excluded from
// path resolution by the EE tsconfig). We import that exact module to stub it.
import NocoLicense from 'src/ee/NocoLicense';
import { getOnPremPlan } from 'src/ee-on-prem/helpers/paymentHelpers';

// Bare `src/...` paths only resolve at compile time via tsconfig paths; for
// runtime require we use file-relative paths.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const eePlanCjs = require('../../../../src/ee/models/Plan');
const utilsCacheKey = require.resolve('../../../../src/ee/utils');
const auditCacheKey = require.resolve('../../../../src/ee/models/Audit');
const paymentHelpersCacheKey = require.resolve(
  '../../../../src/ee/helpers/paymentHelpers',
);
const cloudAuditCacheKey = require.resolve(
  '../../../../src/ee/utils/cloudAudit',
);

function onPremPlanResolutionTests() {
  describe('on-prem plan resolution + audit gate', () => {
  // ────────────────────────────────────────────────────────────────────────
  // Part A: getOnPremPlan — license JWT → OnPremPlanDefinitions
  // ────────────────────────────────────────────────────────────────────────
  describe('getOnPremPlan', () => {
    let getConfigStub: sinon.SinonStub;
    let originalGetSeatLimit: any;

    beforeEach(() => {
      getConfigStub = sinon.stub(NocoLicense, 'getConfig');

      // The EE NocoLicense stub does not declare `getSeatLimit`. The on-prem
      // build adds it. For this test we attach our own and tear it down
      // afterwards so other tests don't see a leaked method.
      originalGetSeatLimit = (NocoLicense as any).getSeatLimit;
      (NocoLicense as any).getSeatLimit = () => null;
    });

    afterEach(() => {
      sinon.restore();
      if (originalGetSeatLimit === undefined) {
        delete (NocoLicense as any).getSeatLimit;
      } else {
        (NocoLicense as any).getSeatLimit = originalGetSeatLimit;
      }
    });

    it('Business plan_title resolves to SELF_HOSTED_BUSINESS with expected meta', () => {
      getConfigStub.returns({
        plan_title: OnPremPlanTitles.SELF_HOSTED_BUSINESS,
      });

      const plan = getOnPremPlan();

      expect(plan.title).to.equal(OnPremPlanTitles.SELF_HOSTED_BUSINESS);
      expect(plan.meta?.[PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]).to.equal(
        false,
      );
      expect(plan.meta?.[PlanFeatureTypes.FEATURE_TABLE_VISIBILITY]).to.equal(
        false,
      );
      expect(plan.meta?.[PlanLimitTypes.LIMIT_AI_INTEGRATIONS]).to.equal(1);
      expect(plan.meta?.[PlanLimitTypes.LIMIT_AUDIT_RETENTION]).to.equal(0);
    });

    it('Enterprise plan_title resolves to SELF_HOSTED_ENTERPRISE with expected meta', () => {
      getConfigStub.returns({
        plan_title: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
      });

      const plan = getOnPremPlan();

      expect(plan.title).to.equal(OnPremPlanTitles.SELF_HOSTED_ENTERPRISE);
      expect(plan.meta?.[PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]).to.equal(
        true,
      );
      expect(plan.meta?.[PlanFeatureTypes.FEATURE_RLS]).to.equal(true);
      expect(plan.meta?.[PlanLimitTypes.LIMIT_AUDIT_RETENTION]).to.equal(-1);
    });

    it('empty config with isEE=true and no seat limit falls back to EnterprisePlan', () => {
      getConfigStub.returns({});
      // The EE stub already returns isEE=true via a getter, and our
      // installed getSeatLimit returns null — so the on-prem helper will
      // hit the `EnterprisePlan` fallback branch.
      (NocoLicense as any).getSeatLimit = () => null;

      // Under tests/unit/tsconfig.ee.json the on-prem helper's
      // `import { EnterprisePlan } from '~/models/Plan'` resolves to
      // src/ee/models/Plan.ts (no EnterprisePlan export). Inject a stand-in
      // so the fallback branch can be observed.
      const hadEnterprisePlan = 'EnterprisePlan' in eePlanCjs;
      const originalEnterprisePlan = eePlanCjs.EnterprisePlan;
      eePlanCjs.EnterprisePlan = {
        title: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
        meta: {},
      };

      try {
        const plan = getOnPremPlan();
        expect(plan.title).to.equal(OnPremPlanTitles.SELF_HOSTED_ENTERPRISE);
      } finally {
        if (hadEnterprisePlan) {
          eePlanCjs.EnterprisePlan = originalEnterprisePlan;
        } else {
          delete eePlanCjs.EnterprisePlan;
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Part B: Audit.insert on-prem gate
  //
  // The on-prem gate guards on `isOnPrem` (an `export const` from
  // `src/ee/utils`). swc-node compiles that to a non-configurable getter
  // backed by a closure variable, so neither direct assignment nor
  // `Object.defineProperty` can mutate it. Instead we swap the cached
  // module exports for a Proxy that intercepts `isOnPrem`, then bust the
  // Audit module from `require.cache` and re-evaluate it so its imports
  // re-bind through the proxy.
  // ────────────────────────────────────────────────────────────────────────
  describe('Audit.insert — on-prem feature gate', () => {
    let getFeatureFake: sinon.SinonStub;
    let bulkMetaInsertStub: sinon.SinonStub;
    let metaInsert2Stub: sinon.SinonStub;
    let AuditWithFakeOnPrem: any;
    let originalUtilsExports: any;
    let originalPaymentHelpersExports: any;
    let originalCloudAuditExports: any;
    // Mutable holder so the Proxy can return whatever the current test set.
    const getFeatureHolder: { fn: (...args: any[]) => Promise<boolean> } = {
      fn: async () => true,
    };

    before(() => {
      // 1. Wrap the cached `src/ee/utils` exports in a Proxy so that any
      //    consumer reading `isOnPrem` sees `true`.
      const utilsModule = require.cache[utilsCacheKey];
      if (!utilsModule) {
        throw new Error(
          `src/ee/utils not in require.cache; key=${utilsCacheKey}`,
        );
      }
      originalUtilsExports = utilsModule.exports;
      utilsModule.exports = new Proxy(originalUtilsExports, {
        get(target, prop) {
          if (prop === 'isOnPrem') return true;
          return (target as any)[prop];
        },
      });

      // 2. Wrap `src/ee/helpers/paymentHelpers` so that `getFeature` is
      //    routed through `getFeatureHolder.fn` — sinon can't stub the
      //    original because its descriptors are non-configurable getters.
      const paymentHelpersModule = require.cache[paymentHelpersCacheKey];
      if (!paymentHelpersModule) {
        throw new Error(
          `paymentHelpers not in require.cache; key=${paymentHelpersCacheKey}`,
        );
      }
      originalPaymentHelpersExports = paymentHelpersModule.exports;
      paymentHelpersModule.exports = new Proxy(originalPaymentHelpersExports, {
        get(target, prop) {
          if (prop === 'getFeature') {
            return (...args: any[]) => getFeatureHolder.fn(...args);
          }
          return (target as any)[prop];
        },
      });

      // 3. Stub `pushAuditToKinesis` (no-op) — likewise blocked from sinon
      //    by non-configurable descriptors, so we proxy it.
      const cloudAuditModule = require.cache[cloudAuditCacheKey];
      if (!cloudAuditModule) {
        throw new Error(
          `cloudAudit not in require.cache; key=${cloudAuditCacheKey}`,
        );
      }
      originalCloudAuditExports = cloudAuditModule.exports;
      cloudAuditModule.exports = new Proxy(originalCloudAuditExports, {
        get(target, prop) {
          if (prop === 'pushAuditToKinesis') {
            return async () => undefined;
          }
          return (target as any)[prop];
        },
      });

      // 4. Bust the Audit module so it re-evaluates and binds against the
      //    proxied utils + paymentHelpers + cloudAudit.
      delete require.cache[auditCacheKey];
      AuditWithFakeOnPrem = require(
        '../../../../src/ee/models/Audit',
      ).default;
    });

    after(() => {
      const utilsModule = require.cache[utilsCacheKey];
      if (utilsModule) utilsModule.exports = originalUtilsExports;
      const paymentHelpersModule = require.cache[paymentHelpersCacheKey];
      if (paymentHelpersModule) {
        paymentHelpersModule.exports = originalPaymentHelpersExports;
      }
      const cloudAuditModule = require.cache[cloudAuditCacheKey];
      if (cloudAuditModule) {
        cloudAuditModule.exports = originalCloudAuditExports;
      }
      // Bust the patched Audit so any later test gets the real `isOnPrem`.
      delete require.cache[auditCacheKey];
    });

    beforeEach(() => {
      getFeatureFake = sinon.stub();
      getFeatureHolder.fn = getFeatureFake;

      bulkMetaInsertStub = sinon.stub().resolves([]);
      metaInsert2Stub = sinon.stub().resolves({});
    });

    afterEach(() => {
      sinon.restore();
    });

    const ncAuditMock = () =>
      ({
        bulkMetaInsert: bulkMetaInsertStub,
        metaInsert2: metaInsert2Stub,
      } as any);

    it('skips insert when on-prem and workspace lacks FEATURE_AUDIT_WORKSPACE', async () => {
      getFeatureFake.resolves(false);

      await AuditWithFakeOnPrem.insert(
        { fk_workspace_id: 'ws_1', op_type: 'TEST' as any },
        ncAuditMock(),
        { forceAwait: true },
      );

      expect(getFeatureFake.calledOnce).to.be.true;
      expect(getFeatureFake.firstCall.args[0]).to.equal(
        PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
      );
      expect(getFeatureFake.firstCall.args[1]).to.equal('ws_1');
      expect(metaInsert2Stub.called).to.be.false;
      expect(bulkMetaInsertStub.called).to.be.false;
    });

    it('proceeds with insert when on-prem and workspace has FEATURE_AUDIT_WORKSPACE', async () => {
      getFeatureFake.resolves(true);

      await AuditWithFakeOnPrem.insert(
        { fk_workspace_id: 'ws_2', op_type: 'TEST' as any },
        ncAuditMock(),
        { forceAwait: true },
      );

      expect(getFeatureFake.calledOnce).to.be.true;
      expect(metaInsert2Stub.calledOnce).to.be.true;
      expect(bulkMetaInsertStub.called).to.be.false;
    });

    it('proceeds with insert without consulting plan when fk_workspace_id is absent (ROOT scope)', async () => {
      await AuditWithFakeOnPrem.insert(
        { op_type: 'TEST' as any },
        ncAuditMock(),
        { forceAwait: true },
      );

      expect(getFeatureFake.called).to.be.false;
      expect(metaInsert2Stub.calledOnce).to.be.true;
      expect(bulkMetaInsertStub.called).to.be.false;
    });
  });
  });
}

export { onPremPlanResolutionTests };
