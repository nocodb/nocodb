import 'mocha';
import { expect } from 'chai';
import {
  PlanFeatureTypes,
  PlanFeatureUpgradeMessages,
  PlanLimitTypes,
  PlanLimitUpgradeMessages,
  PlanOrder,
  PlanTitles,
  resolvePlanMeta,
  PlanFeatureDefinitions,
  PlanLimitDefinitions,
  PlanFeatureTypesToPlanTitles,
} from 'nocodb-sdk';

const allPlans = [
  PlanTitles.FREE,
  PlanTitles.PLUS,
  PlanTitles.BUSINESS,
  PlanTitles.ENTERPRISE,
] as const;

const allFeatures = Object.values(PlanFeatureTypes);
const allLimits = Object.values(PlanLimitTypes);

function planResolutionTests() {
  describe('resolvePlanMeta', () => {
    for (const plan of allPlans) {
      describe(`${plan} plan`, () => {
        let meta: Record<string, number | boolean>;

        before(() => {
          meta = resolvePlanMeta(plan);
        });

        it('should include every PlanFeatureTypes key', () => {
          for (const feature of allFeatures) {
            expect(meta).to.have.property(feature);
          }
        });

        it('should include every PlanLimitTypes key', () => {
          for (const limit of allLimits) {
            expect(meta).to.have.property(limit);
          }
        });

        it('should have boolean values for features', () => {
          for (const feature of allFeatures) {
            expect(meta[feature]).to.be.a(
              'boolean',
              `${feature} should be boolean in ${plan}`,
            );
          }
        });

        it('should have numeric values for limits', () => {
          for (const limit of allLimits) {
            expect(meta[limit]).to.be.a(
              'number',
              `${limit} should be number in ${plan}`,
            );
          }
        });
      });
    }
  });

  describe('Feature tier gating', () => {
    it('every PlanFeatureTypes enum value should appear in exactly one tier of PlanFeatureDefinitions', () => {
      const allDefinedFeatures = Object.values(PlanFeatureDefinitions).flat();

      for (const feature of allFeatures) {
        const count = allDefinedFeatures.filter((f) => f === feature).length;
        expect(count).to.eq(
          1,
          `${feature} should appear in exactly one tier, found ${count}`,
        );
      }
    });

    it('PlanFeatureTypesToPlanTitles should map every feature to a plan', () => {
      for (const feature of allFeatures) {
        expect(PlanFeatureTypesToPlanTitles).to.have.property(feature);
        expect(allPlans).to.include(PlanFeatureTypesToPlanTitles[feature]);
      }
    });

    for (const plan of allPlans) {
      describe(`${plan} plan features`, () => {
        let meta: Record<string, number | boolean>;
        const planOrder = PlanOrder[plan];

        before(() => {
          meta = resolvePlanMeta(plan);
        });

        it('should enable features at or below its tier', () => {
          for (const feature of allFeatures) {
            const minPlan = PlanFeatureTypesToPlanTitles[feature];
            const minOrder = PlanOrder[minPlan];

            if (planOrder >= minOrder) {
              expect(meta[feature]).to.eq(
                true,
                `${plan} (order=${planOrder}) should have ${feature} enabled (min=${minPlan}, order=${minOrder})`,
              );
            }
          }
        });

        it('should disable features above its tier', () => {
          // FREE gets everything enabled (dev/CI fallback)
          if (plan === PlanTitles.FREE) return;

          for (const feature of allFeatures) {
            const minPlan = PlanFeatureTypesToPlanTitles[feature];
            const minOrder = PlanOrder[minPlan];

            if (planOrder < minOrder) {
              expect(meta[feature]).to.eq(
                false,
                `${plan} (order=${planOrder}) should have ${feature} disabled (min=${minPlan}, order=${minOrder})`,
              );
            }
          }
        });
      });
    }
  });

  describe('Limit definitions', () => {
    for (const plan of allPlans) {
      describe(`${plan} plan limits`, () => {
        let meta: Record<string, number | boolean>;

        before(() => {
          meta = resolvePlanMeta(plan);
        });

        it('should apply PlanLimitDefinitions values', () => {
          const planLimits = PlanLimitDefinitions[plan];
          if (!planLimits) return;

          for (const [limit, value] of Object.entries(planLimits)) {
            expect(meta[limit]).to.eq(
              value,
              `${plan} limit ${limit} should be ${value}`,
            );
          }
        });

        it('should default undefined limits to -1 (unlimited)', () => {
          const planLimits = PlanLimitDefinitions[plan] ?? {};

          for (const limit of allLimits) {
            if (!(limit in planLimits)) {
              expect(meta[limit]).to.eq(
                -1,
                `${plan} limit ${limit} should default to -1 (unlimited)`,
              );
            }
          }
        });
      });
    }

    it('PlanLimitDefinitions should only reference valid PlanLimitTypes', () => {
      for (const plan of allPlans) {
        const planLimits = PlanLimitDefinitions[plan];
        if (!planLimits) continue;

        for (const key of Object.keys(planLimits)) {
          expect(allLimits).to.include(
            key,
            `${plan} has unknown limit key: ${key}`,
          );
        }
      }
    });
  });

  describe('Upgrade message completeness', () => {
    it('every PlanFeatureTypes should have an upgrade message', () => {
      for (const feature of allFeatures) {
        expect(PlanFeatureUpgradeMessages).to.have.property(feature);
        expect(PlanFeatureUpgradeMessages[feature]).to.be.a('string').and.not.be
          .empty;
      }
    });

    it('every PlanLimitTypes should have an upgrade message', () => {
      for (const limit of allLimits) {
        expect(PlanLimitUpgradeMessages).to.have.property(limit);
        expect(PlanLimitUpgradeMessages[limit]).to.be.a('string').and.not.be
          .empty;
      }
    });
  });

  describe('Plan ordering', () => {
    it('should have strictly increasing order: FREE < PLUS < BUSINESS < ENTERPRISE', () => {
      expect(PlanOrder[PlanTitles.FREE]).to.be.lessThan(
        PlanOrder[PlanTitles.PLUS],
      );
      expect(PlanOrder[PlanTitles.PLUS]).to.be.lessThan(
        PlanOrder[PlanTitles.BUSINESS],
      );
      expect(PlanOrder[PlanTitles.BUSINESS]).to.be.lessThan(
        PlanOrder[PlanTitles.ENTERPRISE],
      );
    });

    it('higher plans should have all features of lower plans (excluding FREE dev fallback)', () => {
      // Skip FREE as the "lower" plan — it enables everything as a dev/CI fallback
      const paidPlans = allPlans.filter((p) => p !== PlanTitles.FREE);
      for (let i = 1; i < paidPlans.length; i++) {
        const lowerMeta = resolvePlanMeta(paidPlans[i - 1]);
        const higherMeta = resolvePlanMeta(paidPlans[i]);

        for (const feature of allFeatures) {
          if (lowerMeta[feature] === true) {
            expect(higherMeta[feature]).to.eq(
              true,
              `${paidPlans[i]} should have ${feature} enabled since ${
                paidPlans[i - 1]
              } does`,
            );
          }
        }
      }
    });

    it('Enterprise plan should have all features enabled', () => {
      const meta = resolvePlanMeta(PlanTitles.ENTERPRISE);
      for (const feature of allFeatures) {
        expect(meta[feature]).to.eq(
          true,
          `Enterprise should have ${feature} enabled`,
        );
      }
    });
  });

  describe('Per-feature tier verification', () => {
    // Verify each feature is gated at the exact tier defined in PlanFeatureDefinitions
    for (const [plan, features] of Object.entries(PlanFeatureDefinitions)) {
      for (const feature of features) {
        it(`${feature} should unlock at ${plan}`, () => {
          const featureOrder = PlanOrder[plan as PlanTitles];

          for (const checkPlan of allPlans) {
            // Skip FREE — it's the dev/CI fallback with everything enabled
            if (checkPlan === PlanTitles.FREE) continue;

            const checkOrder = PlanOrder[checkPlan];
            const meta = resolvePlanMeta(checkPlan);

            if (checkOrder >= featureOrder) {
              expect(meta[feature]).to.eq(
                true,
                `${feature} should be enabled for ${checkPlan}`,
              );
            } else {
              expect(meta[feature]).to.eq(
                false,
                `${feature} should be disabled for ${checkPlan}`,
              );
            }
          }
        });
      }
    }
  });
}

export { planResolutionTests };
