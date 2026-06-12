import 'mocha';
import { expect } from 'chai';
import {
  AddonDefinitions,
  OnPremPlanTitles,
  PlanAddonTypes,
  PlanFeatureToAddon,
  PlanFeatureTypes,
  PlanTitles,
  applyAddons,
  resolveOnPremPlanMeta,
  resolvePlanMeta,
} from 'nocodb-sdk';

// Pure add-on registry/entitlement invariants — imports ONLY from nocodb-sdk
// (no `~/` backend), so this file runs standalone without the model-graph
// bootstrap:
//   npx mocha --require @swc-node/register \
//     tests/unit/helpersTest/ee/addonRegistry.test.ts
// Stripe-coupled helpers (pickBaseSubscriptionItem) live in addons.test.ts.

// Every feature granted by any add-on. Derived from the registry so a new
// add-on is automatically covered by the unbundling invariants below.
const addonGrantedFeatures: PlanFeatureTypes[] = Array.from(
  new Set(
    Object.values(AddonDefinitions).flatMap(
      (def) => Object.keys(def.grants) as PlanFeatureTypes[],
    ),
  ),
);

export function addonRegistryTests() {
  describe('addons: applyAddons', () => {
    it('grants SCIM feature when ADDON_SCIM is active', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_SCIM]);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(true);
    });

    it('grants white-label feature when ADDON_WHITE_LABEL is active', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_WHITE_LABEL]);
      expect(meta[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(true);
    });

    it('grants MSSQL feature when ADDON_MSSQL is active', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_MSSQL]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_MSSQL]);
      expect(meta[PlanFeatureTypes.FEATURE_MSSQL]).to.equal(true);
    });

    it('mutates in place and leaves unrelated features untouched', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
        [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      };
      applyAddons(meta, [PlanAddonTypes.ADDON_SCIM]);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(true);
      expect(meta[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(false);
    });

    it('is a no-op for undefined active keys', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, undefined);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(false);
    });

    it('is a no-op for an empty array', () => {
      const meta: Record<string, number | boolean> = {
        [PlanFeatureTypes.FEATURE_SCIM]: false,
      };
      applyAddons(meta, []);
      expect(meta[PlanFeatureTypes.FEATURE_SCIM]).to.equal(false);
    });

    it('re-grants every registered add-on feature on top of a fully-unbundled meta', () => {
      // Generic over the registry: each add-on flips its own granted features
      // to true and touches nothing else.
      for (const [addonKey, def] of Object.entries(AddonDefinitions)) {
        const grants = Object.keys(def.grants) as PlanFeatureTypes[];
        const meta: Record<string, number | boolean> = {};
        for (const f of addonGrantedFeatures) meta[f] = false;

        applyAddons(meta, [addonKey as PlanAddonTypes]);

        for (const f of addonGrantedFeatures) {
          expect(
            meta[f],
            `${addonKey} ${
              grants.includes(f) ? 'should grant' : 'must not touch'
            } ${f}`,
          ).to.equal(grants.includes(f));
        }
      }
    });
  });

  describe('addons: PlanFeatureToAddon / AddonDefinitions invariants', () => {
    it('maps each add-on grant back to its owning add-on', () => {
      expect(PlanFeatureToAddon[PlanFeatureTypes.FEATURE_SCIM]).to.equal(
        PlanAddonTypes.ADDON_SCIM,
      );
      expect(PlanFeatureToAddon[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(
        PlanAddonTypes.ADDON_WHITE_LABEL,
      );
      expect(PlanFeatureToAddon[PlanFeatureTypes.FEATURE_MSSQL]).to.equal(
        PlanAddonTypes.ADDON_MSSQL,
      );
    });

    it('is round-trip consistent with AddonDefinitions grants', () => {
      for (const [feature, addonKey] of Object.entries(PlanFeatureToAddon)) {
        const def = AddonDefinitions[addonKey as PlanAddonTypes];
        expect(def, `no AddonDefinition for ${addonKey}`).to.exist;
        expect(
          def.grants[feature as PlanFeatureTypes],
          `${addonKey} does not grant ${feature}`,
        ).to.equal(true);
      }
    });

    it('exposes a reverse mapping for every add-on-granted feature', () => {
      // Catches a new add-on grant that forgets to surface in PlanFeatureToAddon
      // (upgrade CTAs rely on it to advertise the add-on instead of a plan).
      for (const feature of addonGrantedFeatures) {
        expect(
          PlanFeatureToAddon[feature],
          `${feature} has no PlanFeatureToAddon entry`,
        ).to.exist;
      }
    });

    it('pins SCIM as a per-seat add-on sold from Scale upward', () => {
      const def = AddonDefinitions[PlanAddonTypes.ADDON_SCIM];
      expect(def.quantityBasis).to.equal('per_seat');
      expect(def.minPlan.cloud).to.equal(PlanTitles.SCALE);
      expect(def.minPlan.onPrem).to.equal(OnPremPlanTitles.SELF_HOSTED_SCALE);
    });

    it('pins white-label as a per-seat, on-prem-only add-on sold from Scale upward', () => {
      const def = AddonDefinitions[PlanAddonTypes.ADDON_WHITE_LABEL];
      expect(def.quantityBasis).to.equal('per_seat');
      expect(def.minPlan.cloud).to.equal(null);
      expect(def.minPlan.onPrem).to.equal(OnPremPlanTitles.SELF_HOSTED_SCALE);
    });

    it('pins MSSQL as a per-seat add-on sold from Scale upward on both ladders', () => {
      const def = AddonDefinitions[PlanAddonTypes.ADDON_MSSQL];
      expect(def.quantityBasis).to.equal('per_seat');
      expect(def.minPlan.cloud).to.equal(PlanTitles.SCALE);
      expect(def.minPlan.onPrem).to.equal(OnPremPlanTitles.SELF_HOSTED_SCALE);
    });
  });

  // The core regression guard: an add-on grants a capability that NO plan tier
  // grants on its own (entitlement comes only from an active SubscriptionAddon
  // merged via applyAddons). Derived from the registry, so re-bundling an
  // existing add-on feature into a tier OR adding a new add-on without
  // unbundling its feature fails here automatically — on both ladders.
  describe('addons: unbundling invariant (no plan tier grants an add-on feature)', () => {
    it('cloud: every add-on-granted feature is ungranted on every cloud plan', () => {
      for (const plan of Object.values(PlanTitles)) {
        const meta = resolvePlanMeta(plan);
        for (const feature of addonGrantedFeatures) {
          expect(
            meta[feature],
            `${feature} must be add-on-only — not granted by cloud ${plan}`,
          ).to.not.equal(true);
        }
      }
    });

    it('on-prem: every add-on-granted feature is ungranted on every on-prem plan', () => {
      for (const plan of Object.values(OnPremPlanTitles)) {
        const meta = resolveOnPremPlanMeta(plan);
        for (const feature of addonGrantedFeatures) {
          expect(
            meta[feature],
            `${feature} must be add-on-only — not granted by on-prem ${plan}`,
          ).to.not.equal(true);
        }
      }
    });
  });
}
