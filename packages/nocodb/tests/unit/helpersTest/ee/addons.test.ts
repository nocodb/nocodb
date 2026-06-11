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
} from 'nocodb-sdk';
import type Stripe from 'stripe';
import { pickBaseSubscriptionItem } from '~/helpers/paymentHelpers';

type Item = Stripe.SubscriptionItem;

// Minimal Stripe subscription-item mock — pickBaseSubscriptionItem only reads
// `id`, `price.id` and `price.product` (string or expanded object).
const mkItem = (
  id: string,
  priceId: string,
  product: string | { id: string },
): Item => ({ id, price: { id: priceId, product } } as unknown as Item);

export function addonTests() {
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
  });

  describe('addons: PlanFeatureToAddon / AddonDefinitions invariants', () => {
    it('maps each add-on grant back to its owning add-on', () => {
      expect(PlanFeatureToAddon[PlanFeatureTypes.FEATURE_SCIM]).to.equal(
        PlanAddonTypes.ADDON_SCIM,
      );
      expect(PlanFeatureToAddon[PlanFeatureTypes.FEATURE_WHITE_LABEL]).to.equal(
        PlanAddonTypes.ADDON_WHITE_LABEL,
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

    it('pins SCIM as a per-seat add-on sold from Scale upward', () => {
      const def = AddonDefinitions[PlanAddonTypes.ADDON_SCIM];
      expect(def.quantityBasis).to.equal('per_seat');
      expect(def.minPlan.cloud).to.equal(PlanTitles.SCALE);
      expect(def.minPlan.onPrem).to.equal(OnPremPlanTitles.SELF_HOSTED_SCALE);
    });

    it('pins white-label as a flat, on-prem-only Enterprise add-on', () => {
      const def = AddonDefinitions[PlanAddonTypes.ADDON_WHITE_LABEL];
      expect(def.quantityBasis).to.equal('flat');
      expect(def.minPlan.cloud).to.equal(null);
      expect(def.minPlan.onPrem).to.equal(
        OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
      );
    });
  });

  describe('addons: pickBaseSubscriptionItem', () => {
    const PLAN_PRODUCT = 'prod_plan';
    const ADDON_PRODUCT = 'prod_addon';
    const BASE_PRICE = 'price_base';

    it('returns undefined for an empty item list', () => {
      expect(pickBaseSubscriptionItem([])).to.equal(undefined);
    });

    it('returns the only item when the subscription is single-item', () => {
      const only = mkItem('si_1', BASE_PRICE, ADDON_PRODUCT);
      // Even an add-on-looking product wins when it is the sole item.
      expect(
        pickBaseSubscriptionItem([only], {
          addonProductIds: new Set([ADDON_PRODUCT]),
        })?.id,
      ).to.equal('si_1');
    });

    it('excludes add-on products and returns the lone non-add-on item', () => {
      // Add-on item is first — proves the picker does not trust items[0].
      const items = [
        mkItem('si_addon', 'price_addon', ADDON_PRODUCT),
        mkItem('si_base', BASE_PRICE, PLAN_PRODUCT),
      ];
      expect(
        pickBaseSubscriptionItem(items, {
          addonProductIds: new Set([ADDON_PRODUCT]),
        })?.id,
      ).to.equal('si_base');
    });

    it('handles add-on products given as expanded price.product objects', () => {
      const items = [
        mkItem('si_addon', 'price_addon', { id: ADDON_PRODUCT }),
        mkItem('si_base', BASE_PRICE, { id: PLAN_PRODUCT }),
      ];
      expect(
        pickBaseSubscriptionItem(items, {
          addonProductIds: new Set([ADDON_PRODUCT]),
        })?.id,
      ).to.equal('si_base');
    });

    it('falls back to the known plan product when add-ons cannot be excluded', () => {
      // No addonProductIds supplied → both items survive; the plan-product match wins.
      const items = [
        mkItem('si_other', 'price_other', 'prod_other'),
        mkItem('si_base', BASE_PRICE, PLAN_PRODUCT),
      ];
      expect(
        pickBaseSubscriptionItem(items, {
          planProductIds: new Set([PLAN_PRODUCT]),
        })?.id,
      ).to.equal('si_base');
    });

    it('falls back to the locally stored base price id', () => {
      const items = [
        mkItem('si_other', 'price_other', 'prod_other'),
        mkItem('si_base', BASE_PRICE, 'prod_unknown'),
      ];
      expect(
        pickBaseSubscriptionItem(items, { localPriceId: BASE_PRICE })?.id,
      ).to.equal('si_base');
    });

    it('falls back to items[0] when nothing else resolves', () => {
      const items = [
        mkItem('si_first', 'price_a', 'prod_a'),
        mkItem('si_second', 'price_b', 'prod_b'),
      ];
      expect(pickBaseSubscriptionItem(items)?.id).to.equal('si_first');
    });
  });
}
