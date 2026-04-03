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
  CloudPlanDefinitions,
  PlanFeatureTypesToPlanTitles,
  CommonLimits,
  CommonPaidLimits,
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
    it('PlanFeatureTypesToPlanTitles should map every feature to a plan', () => {
      for (const feature of allFeatures) {
        expect(PlanFeatureTypesToPlanTitles).to.have.property(feature);
        expect(allPlans).to.include(PlanFeatureTypesToPlanTitles[feature]);
      }
    });

    it('features disabled at a plan should also be disabled at all lower plans', () => {
      for (const [plan, def] of Object.entries(CloudPlanDefinitions)) {
        const planOrder = PlanOrder[plan as PlanTitles];
        for (const [feature, value] of Object.entries(def.features)) {
          if (value === false) {
            for (const lowerPlan of allPlans) {
              if (PlanOrder[lowerPlan] < planOrder) {
                const lowerDef = CloudPlanDefinitions[lowerPlan];
                expect(lowerDef.features[feature as PlanFeatureTypes]).to.eq(
                  false,
                  `${feature} disabled at ${plan} must also be disabled at lower ${lowerPlan}`,
                );
              }
            }
          }
        }
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

        it('should apply CloudPlanDefinitions limit values', () => {
          const planLimits = CloudPlanDefinitions[plan]?.limits;
          if (!planLimits) return;

          for (const [limit, value] of Object.entries(planLimits)) {
            expect(meta[limit]).to.eq(
              value,
              `${plan} limit ${limit} should be ${value}`,
            );
          }
        });

        it('should default limits not covered by any layer to -1 (unlimited)', () => {
          const planLimits = CloudPlanDefinitions[plan]?.limits ?? {};

          for (const limit of allLimits) {
            // A limit is explicitly set if it appears in any applicable layer:
            // CommonLimits (all plans), CommonPaidLimits (non-Free), or plan-specific
            const inCommon = limit in CommonLimits;
            const inPaid =
              plan !== PlanTitles.FREE && limit in CommonPaidLimits;
            const inPlanSpecific = limit in planLimits;

            if (!inCommon && !inPaid && !inPlanSpecific) {
              expect(meta[limit]).to.eq(
                -1,
                `${plan} limit ${limit} should default to -1 (unlimited)`,
              );
            }
          }
        });
      });
    }

    it('CommonLimits should be applied to all plans', () => {
      for (const plan of allPlans) {
        const meta = resolvePlanMeta(plan);
        for (const [limit, value] of Object.entries(CommonLimits)) {
          // CommonLimits may be overridden by CommonPaidLimits or plan-specific
          const planLimits = CloudPlanDefinitions[plan]?.limits ?? {};
          const paidOverride =
            plan !== PlanTitles.FREE
              ? CommonPaidLimits[limit as PlanLimitTypes]
              : undefined;
          const planOverride = planLimits[limit as PlanLimitTypes];

          const expected = planOverride ?? paidOverride ?? value;
          expect(meta[limit]).to.eq(
            expected,
            `${plan} should have CommonLimits ${limit} = ${expected}`,
          );
        }
      }
    });

    it('CommonPaidLimits should be applied to paid plans only', () => {
      for (const plan of allPlans) {
        const meta = resolvePlanMeta(plan);
        for (const [limit, value] of Object.entries(CommonPaidLimits)) {
          if (plan === PlanTitles.FREE) {
            // Free plan should NOT have CommonPaidLimits — should use CommonLimits value
            const commonValue = CommonLimits[limit as PlanLimitTypes];
            const freeOverride =
              CloudPlanDefinitions[PlanTitles.FREE]?.limits?.[
                limit as PlanLimitTypes
              ];
            expect(meta[limit]).to.eq(
              freeOverride ?? commonValue ?? -1,
              `Free plan should not apply CommonPaidLimits for ${limit}`,
            );
          } else {
            // Paid plans should have CommonPaidLimits (unless plan-specific override)
            const planOverride =
              CloudPlanDefinitions[plan]?.limits?.[limit as PlanLimitTypes];
            expect(meta[limit]).to.eq(
              planOverride ?? value,
              `${plan} should apply CommonPaidLimits ${limit} = ${planOverride ?? value}`,
            );
          }
        }
      }
    });

    it('CloudPlanDefinitions limits should only reference valid PlanLimitTypes', () => {
      for (const plan of allPlans) {
        const planLimits = CloudPlanDefinitions[plan]?.limits;
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

    it('higher plans should have all features of lower plans', () => {
      for (let i = 1; i < allPlans.length; i++) {
        const lowerMeta = resolvePlanMeta(allPlans[i - 1]);
        const higherMeta = resolvePlanMeta(allPlans[i]);

        for (const feature of allFeatures) {
          if (lowerMeta[feature] === true) {
            expect(higherMeta[feature]).to.eq(
              true,
              `${allPlans[i]} should have ${feature} enabled since ${
                allPlans[i - 1]
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
    // Verify each feature is gated at the exact tier defined in PlanFeatureTypesToPlanTitles
    for (const [feature, minPlan] of Object.entries(
      PlanFeatureTypesToPlanTitles,
    )) {
      it(`${feature} should unlock at ${minPlan}`, () => {
        const minOrder = PlanOrder[minPlan as PlanTitles];

        for (const checkPlan of allPlans) {
          const checkOrder = PlanOrder[checkPlan];
          const meta = resolvePlanMeta(checkPlan);

          if (checkOrder >= minOrder) {
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
  });
}

export { planResolutionTests };
