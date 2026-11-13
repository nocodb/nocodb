import { LoyaltyPriceReverseLookupKeyMap, PlanPriceLookupKeys } from './index';

describe('LoyaltyPriceReverseLookupKeyMap', () => {
  it('maps _old loyalty keys to the current Plus prices', () => {
    expect(LoyaltyPriceReverseLookupKeyMap['loyalty_plus_monthly_old']).toBe(
      PlanPriceLookupKeys.PLUS_MONTHLY
    );
    expect(LoyaltyPriceReverseLookupKeyMap['loyalty_plus_yearly_old']).toBe(
      PlanPriceLookupKeys.PLUS_YEARLY
    );
  });

  it('keeps the current keys', () => {
    expect(LoyaltyPriceReverseLookupKeyMap['loyalty_plus_monthly']).toBe(
      PlanPriceLookupKeys.PLUS_MONTHLY
    );
  });
});
