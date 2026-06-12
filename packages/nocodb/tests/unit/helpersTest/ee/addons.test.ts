import 'mocha';
import { expect } from 'chai';
import type Stripe from 'stripe';
import { pickBaseSubscriptionItem } from '~/helpers/paymentHelpers';

// NOTE: this file imports `~/helpers/paymentHelpers` (backend), which pulls in
// the model graph — so it only loads inside the full `test:unit:pg:ee`
// bootstrap (a standalone load hits a `_BaseUser` init-order TDZ). The pure
// add-on registry/entitlement invariants — which are the regression guards —
// live in addonRegistry.test.ts and run standalone.

type Item = Stripe.SubscriptionItem;

// Minimal Stripe subscription-item mock — pickBaseSubscriptionItem only reads
// `id`, `price.id` and `price.product` (string or expanded object).
const mkItem = (
  id: string,
  priceId: string,
  product: string | { id: string },
): Item => ({ id, price: { id: priceId, product } } as unknown as Item);

export function addonTests() {
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
